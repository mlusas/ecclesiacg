(function ($) {

	var worksheetIds = {
		groups: 'oeif2vi',
		links: 'ovbc8ql'
	};

	var gmap; // google map instance
  var geocoder; // google geocoder instance


  var geocodingAreaCenter = [  // Los Angeles, CA 90028, USA
    34.1012181, -118.325739
  ];
  var geocodingAreaRadius = 50;  // (in miles) defines area within this radius from geocodingAreaCenter


  var addressLastSearch; // remembers last user's address searched
  var curAddressMarker; // found user's location marker

	var groupSignupTpl;
	var groupTypes = {};
	var groupSheetColumnsAssign = { // helps to find which and where data have to be put
		'gsx$firstname': {type: 'text', sel: '.profile_firstname'},
		'gsx$lastname': {type: 'text', sel: '.profile_lastname'},
		'gsx$photourl': {type: 'attr', modName: 'src', sel: '.profile_image'},
		'gsx$grouptype': {type: 'text', sel: '.infoTitle_grouptype'},
		'gsx$grouptitle': {type: 'text', sel: '.infoTitle_grouptitle'},
		'gsx$frequency': {type: 'text', sel: '.infoTime_frequency'},
		'gsx$day': {type: 'text', sel: '.infoTime_day'},
		'gsx$time': {type: 'text', sel: '.infoTime_time'},
		'gsx$cat': {type: 'class', sel: '.cat', classes: {Yes: 'yes', No: 'no'}},
		'gsx$dog': {type: 'class', sel: '.dog', classes: {Yes: 'yes', No: 'no'}},
		'gsx$description': {type: 'text', sel: '.infoDescription'},
		'gsx$address': {type: 'text', sel: '.infoTitle_address'},
    'gsx$activeinsummer': {type: 'text', sel: '.infoSummer_bool'},
	};


	/**
	 * request sheet data
	 * @param clb
	 */
	var getSheetData = function (sheetAlias, clb) {
		var spreadSheetId = '10l5ejQ_19dVvr_R0uNMhT5svINJdht4SZFEKj5L0WJ0';
		var sheetId = worksheetIds[sheetAlias];
		var url = 'https://spreadsheets.google.com/feeds/list/' + spreadSheetId + '/' + sheetId + '/public/full';

		$.ajax({
			url: url,
			data: {
				alt: 'json'
			},
			success: clb
		});
	};


	var insertGroupDiv = function (data, rowDiv, parentEl) {
		if (data['gsx$verified'] && data['gsx$verified']['$t'] && data['gsx$verified']['$t'] == '1') {
			var gmapInfoContent = $('.gmap_infoblock_wrap').clone();
			$.each(data, function (colName, obj) {
				if (groupSheetColumnsAssign[colName]) {
					var colParams = groupSheetColumnsAssign[colName];
					var colValue = obj['$t'];
					switch (colParams['type']) {
						case 'text':
							$(rowDiv).find(colParams.sel).text(colValue);
							gmapInfoContent.find(colParams.sel).text(colValue);
							break;
						case 'attr':
              rowDiv.find(colParams.sel).attr(colParams.modName, colValue);
              if( colParams.modName == 'src' && !colValue ){ // remove image if src empty
                rowDiv.find(colParams.sel).remove();
              }
							break;
						case 'class':
							if (colParams.classes[colValue]) {
								rowDiv.find(colParams.sel).addClass(colParams.classes[colValue]);
							}
							break;
					}
					rowDiv.data(colName.replace(/^gsx\$/, ''), colValue);
				}
				if (colName == 'gsx$latitude') {
					rowDiv.data('lat', parseFloat(obj['$t']));
				}
				if (colName == 'gsx$longitude') {
					rowDiv.data('lng', parseFloat(obj['$t']));
				}
			});

      if( !rowDiv.data('lat') || !rowDiv.data('lng') ||
        !rowDiv.data('grouptype') || !rowDiv.data('grouptype') ){
        return;
      }

			var gt = rowDiv.data('grouptype');
			groupTypes[gt] = gt;

			if( groupSignupTpl ){
				var href = groupSignupTpl.template.replace(groupSignupTpl.pattern, rowDiv.find('.infoTitle_grouptitle').text());
				rowDiv.find('.group_signup_link')
					.attr('href', href)
					.show();
				gmapInfoContent.find('.group_signup_link')
					.attr('href', href)
					.show();
			}

			attachMarker(rowDiv, gmapInfoContent.html());
			rowDiv.appendTo(parentEl).show();
		}
	};

	/**
	 * parse received sheet data of available groups and build list of html blocks
	 * @param d
	 */
	var parseGroupsSheetData = function (d) {
		if (d && d.feed && d.feed.entry && d.feed.entry.length) {
			var gr = $('.groupRow:eq(0)');
			var groupParent = $('.groupRows');
			$.each(d.feed.entry, function (i, rowData) {
				insertGroupDiv(rowData, gr.clone(), groupParent);
			});
			$.each(groupTypes, function (v, groupName) {
				$('<option/>', {
					value: groupName,
					text: groupName
				}).appendTo('.grouptypes');
			});
			gr.remove();
		}
		filterList('');
	};

	/**
	 * parse received sheet data of sign up form links and fill hrefs of links
	 * @param d
	 */
	var parseLinksSheetData = function (d) {
		if (d && d.feed && d.feed.entry && d.feed.entry.length) {
			$.each(d.feed.entry, function (i, rowData) {
				if( rowData['gsx$formtype']['$t'] == 'Member Signup' ){
					groupSignupTpl = {
						template: rowData['gsx$url']['$t'],
						pattern: new RegExp("\<GroupTitleFromQuery\>")
					};
				}
			});
		}
	};

	/**
	 * filtering groups list
	 * @param groupType - group type
   * @param address - string of address
	 */
	var filterList = function (address) {
    try {
      var groupType = $('.grouptypes').val();
      if (typeof groupType !== 'undefined') {
        if (groupType) {
          $('.groupRow').each(function (i, v) {
            if ($(v).data('grouptype') == groupType) {
              $(v).show();
              showMarker(v);
            } else {
              $(v).hide();
              hideMarker(v);
            }
          });
        } else {
          $('.groupRow').each(function (i, v) {
            $(v).show();
            showMarker(v);
          });
        }
      }


      if (address) {
        if (addressLastSearch == address) {
          return;
        }
        if (curAddressMarker) {
          curAddressMarker.setMap(null);
        }
        addressLastSearch = address;
        getLocation(address, function (res) { try {
          if (res && res.length) {
            var location = res[0].geometry.location;
            // check if location found is in permitted geocodin area
            if (calcDistance(location.G, location.K, geocodingAreaCenter[0], geocodingAreaCenter[1]) > geocodingAreaRadius) {
              $('.search_message').fadeIn(200, function () {
                setTimeout(function () {
                  $('.search_message').fadeOut(200)
                }, 1500);
              });
              return;
            }

            var forthDist = 0;

            // calculating distances and updating group rows
            $('.groupRow').each(function (i, v) {
              var dist = calcDistance($(v).data('lat'), $(v).data('lng'), location.G, location.K);
              $(v).data('distance', dist);
              $(v).find('.infoDistance_amount').text(Math.round(dist) || "<1");
              $(v).find('.infoDistance_miles').show();
            });

            // sorting groups rows by distance ascending
            var parent = $('.groupRows').parent();
            $(parent).find('.groupRow').sort(function (a, b) {
              return $(a).data('distance') > $(b).data('distance') ? 1 : -1;
            }).appendTo(parent);

            // calculating distance to 4th group location
            $('.groupRow').each(function (i, v) {
              if (i < 4) {
                forthDist = $(v).data('distance');
              }
            });

            // setting center and zoom of map
            gmap.setCenter(location);
            if (forthDist > 0) {
              var zoom = Math.round(13 - Math.log(forthDist) / Math.LN2);
              gmap.setZoom(zoom);
            }

            // creating marker on found address location
            curAddressMarker = new google.maps.Marker({
              position: {lat: location.G, lng: location.K},
              icon: "./images/gmap_icon.png",
              map: gmap,
              title: address
            });
          }
        } catch(er){}});
      }
    } catch(er){}
	};


	/**
	 * attach marker to group div
	 * @param rowdiv
	 */
	var attachMarker = function(rowDiv, content){
		var infowindow = new google.maps.InfoWindow({
			content: content
		});
		var marker = new google.maps.Marker({
			position: {lat: $(rowDiv).data('lat'), lng: $(rowDiv).data('lng')},
			title: $(rowDiv).data('grouptitle')
		});

		marker.addListener('click', function () {
			$('.groupRow').each(function (i, v) {
				var iw = $(v).data('infowindow');
				iw.close();
			});
			infowindow.open(gmap, marker);
		});

		rowDiv.data('marker', marker);
		rowDiv.data('infowindow', infowindow);
		return marker;
	};


	var showMarker = function(rowDiv){
		var marker = $(rowDiv).data('marker');
		marker.setMap(gmap);
	};

	var hideMarker = function(rowDiv){
		var marker = $(rowDiv).data('marker');
		marker.setMap(null);
	};

  /**
   * request coordinates from google geocoder for specified address
   * @param address
   * @param clb
   */
	var getLocation = function(address, clb){
		geocoder.geocode( { 'address': address, componentRestrictions: { country: 'US'}}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        clb(results)
      }
    });
	};

  /**
   * haversine formula for calculating distance for two points on map
   * @returns {number} - distance in miles
   */
  var calcDistance = function(){
    var radians = Array.prototype.map.call(arguments, function(deg) { return deg/180.0 * Math.PI; });
    var lat1 = radians[0], lon1 = radians[1], lat2 = radians[2], lon2 = radians[3];
    //var R = 6372.8; // km
    var R = 3959.87; // miles
    var dLat = lat2 - lat1;
    var dLon = lon2 - lon1;
    var a = Math.sin(dLat / 2) * Math.sin(dLat /2) + Math.sin(dLon / 2) * Math.sin(dLon /2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.asin(Math.sqrt(a));
    return R * c;
  };


	window.gmap_init = function(){
    try{
      gmap = new google.maps.Map(document.getElementById('mapContainer'), {
        center: {lat: 34.0204989, lng: -118.4117325},
        zoom: 9
      });

      geocoder = new google.maps.Geocoder();

      $(document).ready(function(){
        // run
        getSheetData('links', function (d) {
          try {
            parseLinksSheetData(d);
            getSheetData('groups', function(d_){
              try {
                parseGroupsSheetData(d_);
              } catch( er ){}
            });
          } catch( er ){}
        });

        // group types select box event
        $('.grouptypes').change(function () {
          filterList();
        });

        $('.community_group_search_block')
          .on('click', '.groupRow', function () { // group block click event
            new google.maps.event.trigger($(this).data('marker'), 'click');
          })
          .on('keypress', '.search', function (ev) {  // search input box 'Enter' pressing event
            if (ev.which == 13) {
              filterList($(this).val());
            }
          })
          .on('blur', '.search', function () {  // search input box loosing focus event
            filterList($(this).val());
          });
      });

    } catch( er ){}

    // TODO: remove before deploy
    if( window.location.href.match('\.*showArea=1') ){
      // Create marker
      var marker = new google.maps.Marker({
        map: gmap,
        position: new google.maps.LatLng(34.1012181, -118.325739)
      });

      var circle = new google.maps.Circle({
        map: gmap,
        radius: 80465,    // 50 miles
        fillColor: '#bbb',
        strokeColor: '#999',
        strokeWeight: 1
      });
      circle.bindTo('center', marker, 'position');
    };

  };

  // get google maps api
  $.getScript("//maps.googleapis.com/maps/api/js?key=AIzaSyBOJpoDfc07UlLA0uTl5a8c9Wd87WlfyAg&libraries=places&callback=gmap_init");



})($);