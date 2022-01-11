import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from "cookie-parser";
import path,{dirname} from "path";
import cors from 'cors';
import sessions from 'express-session';
import MongoDBStore from 'connect-mongodb-session';
import ServerDAO from './serverDAO.js';
import log from 'loglevel';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

//configure access to .env via process.env
dotenv.config();

/** ToDo : process.env.DEFAULT_LOG_LEVEL **/ 
log.setDefaultLevel(process.env.LOG_LEVEL);

const Store =  MongoDBStore (sessions);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uri = process.env.URI;
const app = express();
const basePath = process.env.BASEPATH;
const store = new Store({
  uri:uri,
  databaseName:process.env.DB_NAME ,
  collection: process.env.DB_SESSIONS
});

store.on('error', function(error) {
  // Also get an error here
  log.warn('session store error::+++++++++',error,'*******')
});

const dao = new ServerDAO();

app.use(express.static(path.resolve(__dirname,process.env.STATIC_APP_PATH )));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true}));
app.use(cookieParser());

//prepare Session and Cookie management taken care of by express-session module
app.use(
	sessions({
    secret: process.env.SESSIONS_SECRET,
      name: process.env.SESSIONS_NAME , 
      store: store,
 saveUninitialized: false,
    resave: false,
      cookie: {
              httpOnly: true,
              secure: false,
              sameSite: true,
              maxAge: 60000 * 15// Time is in miliseconds
          },

  })
);

/***************** Auth ***************************
 * logout, login, loginAnonmously, register w/Email,
 **************************************************/

/**
 *  Logout by closing/destroying the session
 */
app.post(`${basePath}/logout`,function(req,res){

    req.session.destroy(function(err){
        if(err){
            log.error(err);
        } else {
            res.redirect(`${basePath}`);
        }
    });
});


/**
 * Login, with the credentials (email/password) and set session data 
 * which will be stored to the DB
 */
app.post(`${basePath}/registerWithEmail`, async function(req,res){

    const {email, password, firstname, lastname} = req.body;

    if (email && password && firstname && lastname){
        // when user login set the key to redis.
        const result = await dao.registerWithEmail(req.body);
       //if registration is successfull (userid generated), update session
       if (result.userid){ 
        log.info('New user registered correctly');
        req.session.profile = result;
        req.session.userId = result.userid;
        req.session.accessCount = 1;
        req.session.user =result;
        }
         //will compare db values with session values to ensure
       
        res.json(result); 
     }
      else {
        res.json({error:'Invalid Email/Password pair'});
     }
});


/**
 * Login, with the credentials (email/password) and set session data 
 * which will be stored to the DB
 */
app.post(`${basePath}/login`, async function(req,res){

    const {email, password} = req.body;
    if (email && password){
        // when user login set the key to redis.
        const result = await dao.login(req.body);
       if(!result.error){
        req.session.profile = result.app.currentUser.customData;
        req.session.userId = result.app.currentUser.customData.userid;
        req.session.accessCount = 1;
        req.session.user =result.app.currentUser.customData;
         //will compare db values with session values to ensure
         const reservations = await  dao.getReservations();
         req.session.reservations = reservations;
         }
        if (result.error) {  res.json(result); } 
        else  { res.json(result.app.currentUser); }
     }
      else {
        res.json({error:'Invalid Email/Password pair'});
     }
});



/**
 * Login Anonymously if no session found and ensure site
 * data is returned
 */
app.post(`${basePath}/loginAnonymously`,async function(req,res){
var retValue;

    //if session exists, send session data, else gra
    if(req.session.accessCount && req.session.userId){

     //will compare db values with session values to ensure
     const reservations = await  dao.getReservations();
     req.session.reservations = reservations;
     const site = await  dao.getSiteData();
     req.session.site = site;
     const schedule = await  dao.getScheduleItems();
     req.session.schedule = schedule; 

     retValue = {user:req.session.user, site:site, schedule:schedule, reservations:reservations};

    }else
    { retValue = await dao.loadAnonymously(); }
     
    res.send(retValue);

});

/***************** Profile ***************
 * Get, Edit
 ******************************************/

/**
 * Login, with the credentials (email/password) and set session data 
 * which will be stored to the DB
 */
app.put(`${basePath}/editProfile`, async function(req,res){

    const {email, firstname, lastname, phone} = req.body;
    if (email && firstname && phone){
        // when user login set the key to redis.
        const result = await dao.editProfile(req.body);
        req.session.profile = result.profile;
        req.session.user =result.profile;
        res.json(result);
     }
      else {
        res.json({error:'Ensure valid Name and Email'});
     }
});



/**
 * @Deprecated
 * Retrieve Profile
 */
app.get(`${basePath}/getProfile`,async function(req,res){

    const result = await dao.getProfile();
    res.json(result);
});

/***************** Editable SiteData ***************
 * Get, Edit?
 **********************************************/

/**
 * Retrieve customizable site data
 */
app.get(`${basePath}/getSiteData`,async function(req,res){
   
   const result = await dao.getSiteData();

   if(req.session.userId){
     req.session.site = result;
   }
    res.json(result);
});

/***************** Reservation ***************
 * Get, Insert
 **********************************************/

/**
 * Retrieve schedule of availability
 */
app.get(`${basePath}/getScheduleItems`,async function(req,res){

    const result = await dao.getScheduleItems();
    if(req.session.userId)   
        req.session.schedule = result;

    res.json(result);
});

/***************** Reservation ***************
 * Get, Insert
 **********************************************/

/**
 * Retrieve scheduled Reservations
 */
app.get(`${basePath}/getReservations`,async function(req,res){

    const result = await dao.getReservations();

    if(req.session.userId){
        req.session.reservations = result;
        req.session.rescount = result.length;
    }
    res.json(result);
});


/**
 * Login, with the credentials (email/password) and set session data 
 * which will be stored to the DB
 */
app.post(`${basePath}/insertReservation`, async function(req,res){

    const {firstName, lastName, phone} = req.body;
    if (firstName && lastName && phone){
        // when user login set the key to redis.
        const result = await dao.insertReservations(req.body, req.session.userId);
        const reservations = await  dao.getReservations();
         req.session.reservations = reservations;

        res.json(result); 
     }
      else {
        res.json({error:'Invalid Email/Password/phone information'});
     }
});


/**
 * Home Route, starting point to Static React Web App
 */ 
app.get(`${basePath}/`, (req, res) => {

    //update the session access counter and preload front-end app
    if(req.session.userId)
    {
        req.session.accessCount =  req.session.accessCount + 1 ;
    }

    res.sendFile(path.join(__dirname, process.env.STATIC_APP_PATH , "index.html"));
});


app.listen(process.env.PORT,()=>log.info('Basic Express Server running'));
