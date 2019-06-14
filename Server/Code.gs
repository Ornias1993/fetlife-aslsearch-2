/**
 * FetLife ASL Search Server
 *
 * @author <a href="https://maybemaimed.com/tag/fetlife/">maymay</a>
 * @author2 <a href="https://github.com/Ornias1993">Ornias1993</a>
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
    var volume_number = lookupVolumeNumberByUserId(profile_data.user_id);
    if (isNaN(volume_number)) {
      debugLog('Volume number for user ID ' + profile_data.user_id + ' is NaN, skipping.');
      continue;
    }
    var ss_id = getSpreadsheetIdByVolumeNumber(volume_number);
    var ss;
    try {
      ss = SpreadsheetApp.openById(ss_id);
    } catch (ex) {
      debugLog('No spreadsheet with ID ' + ss_id + ', creating a new one');
      ss = createSpreadsheetForVolume(volume_number);
    }
    sheet = ss.getSheetByName(CONFIG.db_sheet_name);
    var result = saveProfileData(sheet, profile_data);
    result.coords.vol = volume_number;
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
  e.parameter.tq = e.parameter.tq || '';
  e.parameter.prefix = e.parameter.prefix || 'google.visualization.Query.setResponse';
  var result = queryAllSpreadsheets(e.parameter.tq, e.parameter.format);

  var output;
  switch (e.parameter.format) {
    case 'csv':
      output = ContentService.createTextOutput();
      for (row in result) {
        for (cell in result[row]) {
          result[row][cell] = '"' + result[row][cell].replace(/"/g, '\\"') + '"';
        }
        output.append(result[row].join(',') + "\n");
      }
      output.setMimeType(ContentService.MimeType.CSV).downloadAsFile('data.csv');
    break;
    case 'json':
      output = ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      break;
    case 'jsonp':
    default:
      output = ContentService.createTextOutput(e.parameter.prefix + '(' + JSON.stringify(result) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    break;
  }
  return output;
}

/**
 * Adds data to a spreadsheet.
 *
 * @param {Sheet} sheet The Google Sheet to add data to.
 * @param {Object} data An object with named properties to add to the sheet.
 * @return {Object}
 */
function saveProfileData (sheet, data) {
  // Prepare cell values.
  for (var key in data) {
    if (data[key] instanceof Array) {
      if (0 === data[key].length) { data[key] = ''; }
      else {
        // prepend an apostrophe to prevent Google Sheets from auto-formatting
        data[key] = "'" + data[key].join(',');
      }
    }
  }

  // Lookup the destination coordinates of the data POST'ed to us.
  // TODO: Can this be optimized without losing per-cell precision?
  var row_index = lookupRowByUserId(sheet, data.user_id);
  if (!row_index) {
    row_index = sheet.getLastRow() + 1;
  }
  var range = sheet.getRange(row_index, 1);
  range.setValue(Date.now()); // update the last scrape time
  var cols = [];
  for (var key in data) {
    var col_name = CONFIG.Fields.headings_nicename[CONFIG.Fields.headings.indexOf(key)];
    var col_index = lookupColumnByName(sheet, col_name);
    cols.push(col_index);
    debugLog(
      'Writing cell value to spreadsheet '
      + sheet.getParent().getId() + ' at ' + row_index + ',' + col_index
      + ' ("' + key + '" : "' + data[key] + '")'
    );
    range = sheet.getRange(row_index, col_index);
    range.setValue(data[key]);
  }
  return {
    'status': "ok",
    'coords': {
      'row': row_index,
      'col': cols
    }
  };
}

/**
 * Handler for the main search form.
 */
function processSearchForm (form_object) {
  return GetFromDB (buildDSQLQuery(form_object));
  //return queryAllSpreadsheets(buildQuery(form_object), 'csv');
}

/**
 * Constructs a Google Query Language query appropriate to a GViz search.
 *
 * @param {object} params Parameters passed from the client.
 * @return {string} A Google Query Language query matching the parameters.
 */
function buildQuery (params) {
  // always add "where C is not null" to the query to avoid getting inactive user IDs
  var query = 'select B, C, D, E, F, G, H, I, J, K, L, M, N, O, W, X where C is not null';
  for (var x in params) {
    if (params[x]) {
      switch (x) {
        case 'nickname[search]':
          query += ' and C ' + params['nickname[operator]'] + " '" + params[x] + "'";
          break;
        case 'user[bio]':
          query += ' and R ' + params['user[bio][operator]'] + ' "' + params[x] + '"';
          break;
        case 'user[websites]':
          query += ' and S ' + params['user[websites][operator]'] + ' "' + params[x] + '"';
          break;
        case 'user[fetishes_into]':
          query += ' and U ' + params['user[fetishes_into][operator]'] + ' "' + params[x] + '"';
          break;
        case 'user[fetishes_curious_about]':
          query += ' and V ' + params['user[fetishes_curious_about][operator]'] + ' "' + params[x] + '"';
          break;
        case 'min_age':
          query += ' and D >= ' + params[x];
          break;
        case 'max_age':
          query += ' and D <= ' + params[x];
          break;
        case 'friends[count]':
          query += ' and G ' + params['friends[operator]'] + ' ' + params[x];
          break;
        case 'friends[exclude_zero]':
          query += ' and G != 0';
          break;
        case 'pictures[count]':
          query += ' and W ' + params['pictures[operator]'] + ' ' + params[x];
          break;
        case 'pictures[exclude_zero]':
          query += ' and W != 0';
          break;
        case 'videos[count]':
          query += ' and X ' + params['videos[operator]'] + ' ' + params[x];
          break;
        case 'videos[exclude_zero]':
          query += ' and X != 0';
          break;
        case 'user[sex]':
          query += ' and (';
          if ('object' === typeof(params[x])) {
            for (var i in params[x]) {
              query += 'E="' + params[x][i] + '"';
              if (i < params[x].length - 1) { query += ' or '; }
            }
          } else {
            query += 'E="' + params[x] + '"';
          }
          query += ')';
          break;
        case 'user[sexual_orientation]':
          query += ' and (';
          if ('object' === typeof(params[x])) {
            for (var i in params[x]) {
              query += 'M="' + params[x][i] + '"';
              if (i < params[x].length - 1) { query += ' or '; }
            }
          } else {
            query += 'M="' + params[x] + '"';
          }
          query += ')';
          break;
        case 'user[role]':
          query += ' and (';
          if ('object' === typeof(params[x])) {
            for (var i in params[x]) {
              query += 'F="' + params[x][i] + '"';
              if (i < params[x].length - 1) { query += ' or '; }
            }
          } else {
            query += 'F="' + params[x] + '"';
          }
          query += ')';
          break;
        case 'user[activity_level]':
          query += ' and (';
          if ('object' === typeof(params[x])) {
            for (var i in params[x]) {
              query += 'N="' + params[x][i] + '"';
              if (i < params[x].length - 1) { query += ' or '; }
            }
          } else {
            query += 'N="' + params[x] + '"';
          }
          query += ')';
          break;
        case 'user[looking_for]':
          query += ' and (';
          if ('object' === typeof(params[x])) {
            for (var i in params[x]) {
              query += 'O contains "' + params[x][i] + '"';
              if (i < params[x].length - 1) { query += ' or '; }
            }
          } else {
            query += 'O contains "' + params[x] + '"';
          }
          query += ')';
          break;
        case 'location_locality':
          if (params[x]) {
            query += ' and I=' + " '" + params[x] + "'";
          }
          break;
        case 'location_region':
          if (params[x]) {
            query += ' and J=' + " '" + params[x] + "'";
          }
          break;
        case 'location_country':
          if (params[x]) {
            query += ' and K=' + " '" + params[x] + "'";
          }
          break;
        case 'user[type]':
          if (params[x]) {
            query += ' and H=' + params[x];
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
  query += ' limit ' + params.limit;
  if (params.offset) {
    query += ' offset ' + params.offset;
  }
  Logger.log('Built query: ' + query);
  return query;
}

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