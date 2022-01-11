import * as Realm from "realm-web";
import log from 'loglevel';

/**
 * @class
 * @description Using the Provider and the React.Context to store teh DB link.
 * 
 * @param demoAppId : The Realm Aplication ID
 * @param children : the nodes nested within component
 */
export default class ServerDAO  {

  constructor(logLevel) {
    if (logLevel)
     log.setLevel(logLevel);

     this.app = new Realm.App(process.env.MONGODB_REALM_APPID); 
  }


  /**
   *  login with the provided Login Credentials.  After loggin in , set Profile and Reservations
   */
  loadAnonymously = async  ()=> {
      let anonUser;
       if(this.app?.currentUser?.customData?.email){
        anonUser = this.app.currentUser;
    }
    else{
        anonUser = await this.app?.logIn(Realm.Credentials.anonymous());
   }
      const site =   await this.getSiteData();
      const schedule = await this.getScheduleItems(); 
      let reservations = null;
      let profile = null; 

      if(this.app.currentUser?.customData?.email){
       reservations = await this.getReservations(); 

       profile = this.app.currentUser.customData;
      }
//console.log({user: this.anonUser, site:this.site, schedule:this.schedule});
      return {user: anonUser, site:site, schedule:schedule, reservations:reservations, profile:profile};
}


/**
 * @desc ensure customData object is not stale
 * 
 * @returns profile info as object
 *
*/
 refreshCustomData = async ()=>{
 await this.app?.currentUser?.refreshCustomData(); 
 return this.app?.currentUser?.customData;
}
   

/**
 * @desc Add an item to schedule
 * 
 * @returns profile info as object
 *
*/
 addScheduledItem = async (item)=>{
    try
    {
 const result = await this.app?.currentUser?.functions.addScheduledItem(item); 
return result;

}catch(error){
    return{error}
}
}


/**
 * @desc ensure customData object is not stale
 * 
 * @returns profile info as object
 *
*/
 getScheduleItems = async ()=>{
 const results =  await this.app?.currentUser?.functions.getScheduleItems({}); 
 
 return results;
}


/**
 * @desc ensure customData object is not stale
 * 
 * @returns profile info as object
 *
*/
 removeScheduledItems = async ()=>{
 return await this.app?.currentUser?.functions.DeleteFromAvailabilityCalendar(); 
}


  /**
   *  login with the provided Login Credentials.  After loggin in , set Profile and Reservations
   */
  login =async  (credentials) =>{
    try
    {
      //tell store that a login is being attempted
     const loginResult =  await this.app.logIn(Realm.Credentials.emailPassword(credentials.email, credentials.password));
     return loginResult;
    } catch(error)
    {
      const msg = this.handleAuthenticationError(error);
      log.error(error);
      return {error:msg};
    }
  }
 

/**
 *  Logout current user
 */
  logOut = async ()=> {
    // Log out the currently active user
    this.app?.currentUser?.logOut();
  }


/**
 * Register user by autoconfirmaed email, 
 * @params email, password needed for registration
 * @params firstName, lastName : needed for profile
 * @params phone: optional
 * 
 */
  registerWithEmail =async  (registerData)=> {
    try{
     // const args = {email,password,firstName, lastName, phone};
     //  dispatch(register(args));

log.warn('registration attempt in dao',registerData);
     await this.app.emailPasswordAuth.registerUser(registerData.email, registerData.password);
     const user = await this.app?.logIn(Realm.Credentials.emailPassword(registerData.email, registerData.password));
   
    //add CustomData
    await user.functions?.AddUserData({...registerData, userid:this.app?.currentUser?.id});

          return  this.refreshCustomData();

}catch(error){
  log.error(error);
  return {error:this.handleAuthenticationError(error)};
}

  }


/**
 * Return Profile of registered user.
 * 
 */
 getProfile = async ()=> {
    
     let prof = null;
     try{
     prof = await this.app?.currentUser?.functions?.GetUserData(this.app?.currentUser?.id);
    }catch(error){
       const { status, message } = this.parseAuthenticationError(error);
       log.error(error);
       return {error:status+message};
    }
return prof;
}


/**
 * Edit Profile of registered user.
 * 
 * @param profileObj: 
 * 
 */
 editProfile = async (profileObj)=> {
    try{
     const prof = await this.app?.currentUser?.functions?.EditProfile(profileObj);
     return prof;
    }catch(error){
        log.error(error);
       return {error:error.message};
    }
}


/**
 * Read Site Data: If user object has the *?.functions* variable available
 *   then retrieve the Site Data, otherwise anonymously login first for access 
 *   to backend functions.
 *  @return {object} site -  {pageData:HOME_PAGE_DEFAULT, cardData:TIERS};
 */
  getSiteData = async ()=> {
 
     try{
       const site =   await this.app.currentUser.functions.GetSiteData();
    
      return site;
    }catch(error){
     const {  message } = this.parseAuthenticationError(error);
     log.error(error);
     return {error:message};
    }
}


/**
 * Edits data  for the Home Page by a registered Admin user.  
 * @param newPageData takes a HOME_PAGE_DEFAULT type object
 */
 editHomeData = async (newPageData) =>{
  
try{
if (newPageData){
//const obj ={screen:'home_general',pageData:newPageData.pageData, cardData:newPageData.cardData}

     const editResults = await this.app?.currentUser?.functions.EditHomeData(newPageData);
     log.debug(editResults);
//this.setSiteData({screen:'home_general',pageData:newPageData.pageData, contactData:newPageData.contactData, cardData:newPageData.cardData});

}else
{
  const resetResults = await this.app?.currentUser?.functions?.EditHomeData();
  log.debug(resetResults);
  //const newdata = await this.getSiteData();
  //console.log('new site returned from db=',newdata);

}
}catch(error){
  const {  message } = this.parseAuthenticationError(error);

       return {error:message};
}
 

}



/**
 *  Allows a registered user to add a new reservation
 * @param {reservation}
 */
 insertReservations = async  (reservation, userid)=> {

   const newReservation = {...reservation, dateAdded :(new Date()), userid:userid };
   const result = await this.app.currentUser?.functions.InsertReservation(newReservation);

 return result;
}


/**
 *  Return all Reservations by query, for loggedIn and connected users
 *  @return JSON.parse(reservation_array)
 */
getReservations = async  ()=>{
  try
  {
  const res = await this.app.currentUser?.functions?.FindReservation();
  //log.info("retrieved reservations=",res)
  if(!res) return [];

  return (JSON.parse(res));
}catch(err){
return {error:err};
}
}

  handleAuthenticationError= (err)=> {
  let returnMsg=null;
  const { status, message } = this.parseAuthenticationError(err);
  const errorType = message || status;

  switch (errorType) {
    case "invalid username":
       returnMsg = "Invalid email address." ;
      break;
    case "invalid username/password":
    case "invalid password":
    case "401":

      returnMsg =  "Incorrect password.";
      break;
    case "name already in use":
    case "409":
//      setError((err) => ({ ...err, errorMsg: "Email is already registered." }));
      returnMsg = "Email is already registered." ;
      break;
    case "password must be between 6 and 128 characters":
    case "400":
     // setError((err) => ({...err,  errorMsg: "Password must be between 6 and 128 characters."  }));
      returnMsg = "Password must be between 6 and 128 characters.";
      break;
    default:
      break;
  }
  return returnMsg ;
}

  parseAuthenticationError = (err)=> {
  const parts = err.message.split(":");
  const reason = parts[parts.length - 1].trimStart();
  if (!reason) return { status: "", message: "" };
  const reasonRegex = /(?<message>.+)\s\(status (?<status>[0-9][0-9][0-9])/;
  const match = reason.match(reasonRegex);
  const { status, message } = match?.groups ?? {};
  return { status, message };
}

}


