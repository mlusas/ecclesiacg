(function ($) {

	var worksheetIds = {
		groups: 'oeif2vi',
		links: 'ovbc8ql'
	};

	var gmap;
  var geocoder;

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
	var filterList = function (groupType, address) {
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
    if (typeof address !== 'undefined') {
      getLocation(address, function(res){
        if( res && res.length ){
          var location = res[0].geometry.location;

          var forthDist = 0;

          $('.groupRow').each(function (i, v) {
            var dist = calcDistance($(v).data('lat'), $(v).data('lng'), location.G, location.K);
            $(v).data('distance', dist);
            $(v).find('.infoDistance_amount').text(Math.round(dist) || "<1");
            $(v).find('.infoDistance_miles').show();
          });

          var parent = $('.groupRows').parent();
          $(parent).find('.groupRow').sort(function (a, b) {
            return $(a).data('distance') > $(b).data('distance');
          }).appendTo( parent );

          $('.groupRow').each(function (i, v) {
            if( i < 4 ){
              forthDist = $(v).data('distance');
            }
          });


          gmap.setCenter(location);
          if( forthDist > 0 ){
            var zoom = Math.round(14-Math.log(forthDist)/Math.LN2);
            gmap.setZoom(zoom);
          }
        }
      });
    }
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

	var getLocation = function(address, clb){
		geocoder.geocode( { 'address': address, componentRestrictions: { country: 'US'}}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        clb(results)
      }
    });
	};

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
		gmap = new google.maps.Map(document.getElementById('mapContainer'), {
			center: {lat: 34.0204989, lng: -118.4117325},
			zoom: 9
		});

    geocoder = new google.maps.Geocoder();

    $(document).ready(function(){
      // run
      getSheetData('links', function(d){
        parseLinksSheetData(d);
        getSheetData('groups', parseGroupsSheetData);
      });

      // group types select box event
      $('.grouptypes').change(function () {
        var curGroupType = $(this).val();
        filterList(curGroupType);
      });

      // group block click event
      $('.community_group_search_block')
        .on('click', '.groupRow', function(){
          new google.maps.event.trigger( $(this).data('marker'), 'click' );
        })
        .on('keypress', '.search', function(ev){
          if ( ev.which == 13 ) {
            filterList(null, $(this).val());
          }
        }
      );
    });

    /*defaultBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(32.936065, -119.574867),
      new google.maps.LatLng(35.143478, -116.221291)
    );
    var input = document.getElementsByClassName('search');
    var options = {
      bounds: defaultBounds,
      types: ['establishment'],
      componentRestrictions: { country: 'US'}
    };

    autocomplete = new google.maps.places.Autocomplete(input[0], options);*/

	};




})($);