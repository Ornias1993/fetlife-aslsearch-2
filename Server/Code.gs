/**
 * FetLife ASL Search Server
 *
 * @author <a href="https://github.com/Ornias1993">Ornias1993</a>
 */


function doGet (e) {
  var output;
  switch (e.parameter.action) {
    case 'query':
      output = doQuery(e);
      break;
    default:
      var t = HtmlService.createTemplateFromFile('index');
      t.GET = e;
      output = t.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      break;
  }
  return output;
}

function doPost (e) {
  var response = [];
  var profiles = JSON.parse(e.parameter.post_data);
  if (!(profiles instanceof Array)) {
    profiles = [profiles];
  }
  for (var profile in profiles) {
    var profile_data = validateScraperInput(profiles[profile]);
    var result = saveProfileData(profile_data);

    response.push(result);
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Checks the data we received from the scraper to make sure it is as valid as can be.
 *
 * @param {object} obj Scraped input data.
 * @return {object} Filtered input with unsanitized or invalid inputs removed.
 */
function validateScraperInput (obj) {
  var safe_obj = {};
  
  for (var k in obj) {
    if(typeof obj[k] == 'string'){
      mysql_real_escape_string(obj[k]);
    } 
    
    switch (k) {
      case 'user_id':
      case 'age':
      case 'friend_count':
      case 'num_pics':
      case 'num_vids':
        safe_obj[k] = parseInt(obj[k]);
        break;
      case 'paid_account':
        if ('boolean' === typeof(obj[k])) {
          safe_obj[k] = obj[k];
        } else {
          debugLog('WARNING: Expected boolean value in ' + obj[k]);
        }
        break;
      case 'avatar_url':
        if (obj[k].match(/^https:\/\/pic[0-9]*\.fetlife\.com/)) {
          safe_obj[k] = obj[k];
        }
        break;
      default:
        // TODO: Stricter?
        if (-1 !== CONFIG.Fields.headings.indexOf(k)) {
          safe_obj[k] = obj[k];
        }
        break;
    }
  }
  return safe_obj;
}

/**
 * Processes an HTTP GET with the action=query parameter set.
 *
 * @param {object} e Parameters from the HTTP GET or POST event.
 * @return {TextOutput} A TextOutput object with the appropriate MIME type.
 */
function doQuery (e) {
  //Depricated, needs to be remade almost completely
  return output;
}

/**
 * Adds data the Database.
 *
 * @param {Object} data An object with named properties.
 * @return {Object}
 */
function saveProfileData (data) {
  // check if userentry already exists
  var row_index = GetFromDB ("SELECT User_ID FROM UserData where User_ID= " + data.user_id)
  
  //if not already here, dont update, add new
  if (!row_index[1]) {
  var insert = requestInsert(data);
  return insert
  }

  else if (row_index[1]) {
  var update = requestUpdate(data);
  return update
  }

  else{
   return {
    'DB_Response': "Cant Process",
    'for_User' : data.user_id
  };
}
}

/**
 * Creates an Array from scraperdata to send to SQL Insert processor
 */

function requestInsert(data){
  //create new row here
  console.log("no such thing");
    

  
  var toInsert = [[]];
  toInsert.push([]);

  //creates array of data to write away
  for (var key in data) {
    console.log("Output: " + key + " " + data[key]);
    toInsert[0].push(key);
    toInsert[1].push(data[key]);
    
    }
    console.log("data in toInsert: " + toInsert[1][1]);
  var response = InsertToDB(data.user_id, toInsert);
    
  return {
    'DB_Response': "Added",
    'for_User' : response
  };
}


/**
 * Creates an Array from scraperdata to send to SQL Update processor
 */

function requestUpdate(data){

  
  var toUpdate = [[]];
  toUpdate.push([]);
  //creates list of data to write away
  for (var key in data) {
    console.log("Output: " + key + " " + data[key]);
    toUpdate[0].push(key);
    toUpdate[1].push(data[key]);
    
    }
    console.log("data in toUpdate: " + toUpdate[1][1]);
  var response = UpdateToDB(data.user_id, toUpdate);
  

   return {
    'DB_Response': "Updated",
    'for_User' : response
  };
}

/**
 * Handler for the main search form.
 */
function processSearchForm (form_object) {
  return GetFromDB (buildDSQLQuery(form_object));
}

/**
 * Creates SQL query from search form input.
 */
function buildDSQLQuery (params) {
  // always add "where C is not null" to the query to avoid getting inactive user IDs
  var query = 'select User_ID, Nickname, Age, Gender, Role, Friend_Count, Paid_Account, Locality, Region, Country, Avatar_URL, Sexual_Orientation, Interest_Level_Active, Looking_For, Number_of_Pictures, Number_of_Videos FROM UserData where Nickname is not null';
  for (var x in params) {
    if (params[x]) {
      switch (x) {
        case 'nickname[search]':
          if(params['nickname[operator]'] == "matches"){
          query += " and Nickname= '" + params[x] + "'";
          break;
          }
          else{
          query += ' and Nickname ' + params['nickname[operator]'] + ' "' + params[x] + '"';
          break
          }
        case 'user[bio]':
          if(params['Bio_About_Me[operator]'] == "matches"){
          query += " Bio_About_Me= '" + params[x] + "'";
          break;
          }
          else{
          query += ' and Bio_About_Me ' + params['user[bio][operator]'] + ' "' + params[x] + '"';
          break
          }
        case 'user[websites]':
          if(params['Websites[operator]'] == "matches"){
          query += " Websites= '" + params[x] + "'";
          break;
          }
          else{
          query += ' and Websites ' + params['user[websites][operator]'] + ' "' + params[x] + '"';
          break;
          }
        case 'user[fetishes_into]':
          if(params['Fetishes_Into[operator]'] == "matches"){
          query += " Fetishes_Into= '" + params[x] + "'";
          break;
          }
          else{
          query += ' and Fetishes_Into ' + params['user[fetishes_into][operator]'] + ' "' + params[x] + '"';
          break;
          }
        case 'user[fetishes_curious_about]':
          if(params['Fetishes_Curious_About[operator]'] == "matches"){
          query += " Fetishes_Curious_About= '" + params[x] + "'";
          break;
          }
          else{
          query += ' and Fetishes_Curious_About ' + params['user[fetishes_curious_about][operator]'] + ' "' + params[x] + '"';
          break
          }
        case 'min_age':
          query += ' and Age >= ' + params[x];
          break;
        case 'max_age':
          query += ' and Age <= ' + params[x];
          break;
        case 'friends[count]':
          query += ' and Friend_Count ' + params['friends[operator]'] + ' ' + params[x];
          break;
        case 'friends[exclude_zero]':
          query += ' and Friend_Count != 0';
          break;
        case 'pictures[count]':
          query += ' and Number_of_Pictures ' + params['pictures[operator]'] + ' ' + params[x];
          break;
        case 'pictures[exclude_zero]':
          query += ' and Number_of_Pictures != 0';
          break;
        case 'videos[count]':
          query += ' and Number_of_Videos ' + params['videos[operator]'] + ' ' + params[x];
          break;
        case 'videos[exclude_zero]':
          query += ' and Number_of_Videos != 0';
          break;
        case 'user[sex]':
          query += ' and (';
          if ('object' === typeof(params[x])) {
            for (var i in params[x]) {
              query += 'Gender="' + params[x][i] + '"';
              if (i < params[x].length - 1) { query += ' or '; }
            }
          } else {
            query += 'Gender="' + params[x] + '"';
          }
          query += ')';
          break;
        case 'user[sexual_orientation]':
          query += ' and (';
          if ('object' === typeof(params[x])) {
            for (var i in params[x]) {
              query += 'Sexual_Orientation="' + params[x][i] + '"';
              if (i < params[x].length - 1) { query += ' or '; }
            }
          } else {
            query += 'Sexual_Orientation="' + params[x] + '"';
          }
          query += ')';
          break;
        case 'user[role]':
          query += ' and (';
          if ('object' === typeof(params[x])) {
            for (var i in params[x]) {
              query += 'Role="' + params[x][i] + '"';
              if (i < params[x].length - 1) { query += ' or '; }
            }
          } else {
            query += 'Role="' + params[x] + '"';
          }
          query += ')';
          break;
        case 'user[activity_level]':
          query += ' and (';
          if ('object' === typeof(params[x])) {
            for (var i in params[x]) {
              query += 'Interest_Level_Active="' + params[x][i] + '"';
              if (i < params[x].length - 1) { query += ' or '; }
            }
          } else {
            query += 'Interest_Level_Active="' + params[x] + '"';
          }
          query += ')';
          break;
        case 'user[looking_for]':
          query += ' and (';
          if ('object' === typeof(params[x])) {
            for (var i in params[x]) {
              query += 'Looking_For= "' + params[x][i] + '"';
              if (i < params[x].length - 1) { query += ' or '; }
            }
          } else {
            query += 'Looking_For= "' + params[x] + '"';
          }
          query += ')';
          break;
        case 'location_locality':
          if (params[x]) {
            query += ' and Locality=' + " '" + params[x] + "'";
          }
          break;
        case 'location_region':
          if (params[x]) {
            query += ' and Region=' + " '" + params[x] + "'";
          }
          break;
        case 'location_country':
          if (params[x]) {
            query += ' and Country=' + " '" + params[x] + "'";
          }
          break;
        case 'user[type]':
          if (params[x]) {
            query += ' and Paid_Account=' + params[x];
          }
          break;
//        // TODO:
//        case 'user[vanilla_relationships]':
//          if (params[x]) {
//            query += ' and P ' + params[x];
//          }
//          break;
      }
    }
  }
  Logger.log('Built query: ' + query);
  return query;
}