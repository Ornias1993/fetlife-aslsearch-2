var libVERSAN = require('./libVERSAN.js');


module.exports = {
    /**
   * Handler for the main search form.
   */
 
  processSearchForm: function  (form_object) {

    //Verify if GET is right format
    console.log(Object.keys(form_object));
    if(libVERSAN.isObject(form_object) && libVERSAN.isString(Object.keys(form_object)[0] )){
    
    //Seperate needed data from GET, Decode to processable format and turn into SQL string
    var form_object = Object.keys(form_object)[0];
    try {
      var json = JSON.parse(decodeURIComponent(form_object));
      var response = buildSQLQuery(json)
      return response
    } 
    
    // Return null if error
    catch (e) {
      console.error(e);
      return
    }
  }
  // Return null if format verification failed
  else
  {
    return
  }

  },


  processSearchQuery: function  (rawFields, rawResults) {
    var processed = arrayGen(rawFields, rawResults);
    return processed
  }


};

function arrayGen (rawFields, rawResults){
    var resultsArray = [[]];
      //fill first entry in array with colomn names
      Object.keys(rawFields).forEach(function(key) {
        // Do stuff with name
        resultsArray[0].push(rawFields[key].name);
      });
    
        var count = 1;
        Object.keys(rawResults).forEach(function(key) {
          // Do stuff with name
          resultsArray.push([]);
    
          resultsArray[0].forEach(function(element) {
            if(rawResults[key][element] != null) {
              resultsArray[count].push(rawResults[key][element]);
            }
            else {
            resultsArray[count].push("");
            } 
          });
          count++
    
        });
return resultsArray
}

/**
   * Creates SQL query from search form input.
   */
  function buildSQLQuery (params) {
    // always add "where C is not null" to the query to avoid getting inactive user IDs
    var query = 'select user_id, nickname, age, gender, role, friend_count, paid_account, location_locality, location_region, location_country, avatar_url, sexual_orientation, interest_level, looking_for, num_pics, num_vids FROM UserData where nickname is not null';
    for (var x in params) {
      if (params[x]) {
        switch (x) {
          //Cases filter input from form, only accept known input options
          case 'nickname(search)':
            if(params['nickname(operator)'] == "matches"){
            params[x] = libVERSAN.sanString(params[x]);
            query += " and nickname= " + params[x];
            break;
            }
            else{
            params[x] = '%' + params[x] + '%'
            params[x] = libVERSAN.sanString(params[x]);
            query += ' and nickname ' + ' LIKE ' + params[x];
            break
            }
          case 'user(bio)':
            console.log(params['user(bio)(operator])']);
            if(params['user(bio)(operator])'] == "matches"){
            params[x] = libVERSAN.sanString(params[x]);
            query += " and bio= " + params[x];
            break;
            }
            else{
            params[x] = '%' + params[x] + '%'
            params[x] = libVERSAN.sanString(params[x]);
            query += ' and bio ' + ' LIKE ' + params[x];
            break
            }
          case 'user(websites)':
            if(params['user(websites)(operator)'] == "matches"){
            params[x] = libVERSAN.sanString(params[x]);
            query += " and websites= " + params[x];
            break;
            }
            else{
            params[x] = '%' + params[x] + '%'
            params[x] = libVERSAN.sanString(params[x]);
            query += ' and websites ' + ' LIKE ' + params[x];
            break;
            }
          case 'user(fetishes_into)':
            if(params['user(fetishes_into)(operator)'] == "matches"){
            params[x] = libVERSAN.sanString(params[x]);
            query += " and fetishes_into= " + params[x];
            break;
            }
            else{
            params[x] = '%' + params[x] + '%'
            params[x] = libVERSAN.sanString(params[x]);
            query += ' and fetishes_into ' + ' LIKE ' + params[x];
            break;
            }
          case 'user(fetishes_curious_about)':
            if(params['user(fetishes_curious_about)(operator)'] == "matches"){
            params[x] = libVERSAN.sanString(params[x]);
            query += " and fetishes_curious_about= " + params[x];
            break;
            }
            else{
            params[x] = '%' + params[x] + '%'
            params[x] = libVERSAN.sanString(params[x]);
            query += ' and fetishes_curious_about ' + ' LIKE ' + params[x];
            break
            }
          case 'min_age':
            params[x] = libVERSAN.sanINT(params[x]);
            query += ' and age >= ' + params[x];
            break;
          case 'max_age':
            params[x] = libVERSAN.sanINT(params[x]);
            query += ' and age <= ' + params[x];
            break;
          case 'friends(count)':
            params[x] = libVERSAN.sanINT(params[x]);
            query += ' and friend_count ' + params['friend_count(operator)'] + ' ' + params[x];
            break;
          case 'friends(count)':
            params[x] = libVERSAN.sanINT(params[x]);
            query += ' and friend_count != 0';
            break;
          case 'pictures(count)':
            params[x] = libVERSAN.sanINT(params[x]);
            query += ' and num_pics ' + params['num_pics(operator)'] + ' ' + params[x];
            break;
          case 'pictures(count)':
            params[x] = libVERSAN.sanINT(params[x]);
            query += ' and num_pics != 0';
            break;
          case 'videos(count)':
            params[x] = libVERSAN.sanINT(params[x]);
            query += ' and num_vids ' + params['num_vids(operator)'] + ' ' + params[x];
            break;
          case 'videos(count)':
            params[x] = libVERSAN.sanINT(params[x]);
            query += ' and num_vids != 0';
            break;
          case 'user(sex)':
            query += ' and (';
            if ('object' === typeof(params[x])) {
              for (var i in params[x]) {
                query += 'gender="' + params[x][i] + '"';
                if (i < params[x].length - 1) { query += ' or '; }
              }
            } else {
              params[x] = libVERSAN.sanString(params[x]);
              query += 'gender= ' + params[x];
            }
            query += ')';
            break;
          case 'user(sexual_orientation)':
            query += ' and (';
            if ('object' === typeof(params[x])) {
              for (var i in params[x]) {
                query += 'sexual_orientation="' + params[x][i] + '"';
                if (i < params[x].length - 1) { query += ' or '; }
              }
            } else {
              params[x] = libVERSAN.sanString(params[x]);
              query += 'sexual_orientation= ' + params[x];
            }
            query += ')';
            break;
          case 'user(role)':
            query += ' and (';
            if ('object' === typeof(params[x])) {
              for (var i in params[x]) {
                query += 'role="' + params[x][i] + '"';
                if (i < params[x].length - 1) { query += ' or '; }
              }
            } else {
              params[x] = libVERSAN.sanString(params[x]);
              query += 'role= ' + params[x];
            }
            query += ')';
            break;
          case 'user(activity_level)':
            query += ' and (';
            if ('object' === typeof(params[x])) {
              for (var i in params[x]) {
                query += 'interest_level="' + params[x][i] + '"';
                if (i < params[x].length - 1) { query += ' or '; }
              }
            } else {
              params[x] = libVERSAN.sanString(params[x]);
              query += 'interest_level= ' + params[x];
            }
            query += ')';
            break;
          case 'user(looking_for)':
            query += ' and (';
            if ('object' === typeof(params[x])) {
              for (var i in params[x]) {
                query += 'looking_for= "' + params[x][i] + '"';
                if (i < params[x].length - 1) { query += ' or '; }
              }
            } else {
              params[x] = libVERSAN.sanString(params[x]);
              query += 'looking_for= ' + params[x];
            }
            query += ')';
            break;
          case 'location_locality':
            params[x] = libVERSAN.sanString(params[x]);
            if (params[x]) {
              query += ' and location_locality= ' + params[x];
            }
            break;
          case 'location_region':
            params[x] = libVERSAN.sanString(params[x]);
            if (params[x]) {
              query += ' and location_region= ' + params[x];
            }
            break;
          case 'location_country':
            params[x] = libVERSAN.sanString(params[x]);
            if (params[x]) {
              query += ' and location_country= ' + params[x];
            }
            break;
          case 'user(type)':
            if (params[x]) {
              query += ' and paid_account=' + params[x];
            }
            break;
  //        // TODO:
  //        case 'user(vanilla_relationships)':
  //          if (params[x]) {
  //            query += ' and P ' + params[x];
  //          }
  //          break;
        }
      }
    }
    query += " LIMIT 30"; 
    console.log('Built query: ' + query);
    return query;
  }