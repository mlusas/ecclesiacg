(function ($) {

	var worksheetIds = {
		groups: 'oeif2vi',
		links: 'ovbc8ql'
	};

	var gmap;

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
	 * authorize using oAuth 2.0 in silent mode to get access to spreadsheet
	 * @param clb
	 */
	var authorize = function (clb) {
		var config = {
			'client_id': '98604355830-ffverp07e7maspub3ipialbjjafttohk.apps.googleusercontent.com',
			'scope': 'https://spreadsheets.google.com/feeds',
			'immediate': true // auth without google popup
		};
		gapi.auth.authorize(config, clb);
	};

	/**
	 * request sheet data
	 * @param clb
	 */
	var getSheetData = function (sheetAlias, clb) {
		var token = gapi.auth.getToken();
		var accessToken = token['access_token'];
		var spreadSheetId = '10l5ejQ_19dVvr_R0uNMhT5svINJdht4SZFEKj5L0WJ0';
		var sheetId = worksheetIds[sheetAlias];
		var url = 'https://spreadsheets.google.com/feeds/list/' + spreadSheetId + '/' + sheetId + '/private/full';

		$.ajax({
			url: url,
			data: {
				alt: 'json',
				access_token: accessToken
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
					rowDiv.data('latitude', parseFloat(obj['$t']));
				}
				if (colName == 'gsx$longitude') {
					rowDiv.data('longitude', parseFloat(obj['$t']));
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
			var groupParent = gr.parent();
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
	 */
	var filterList = function (groupType) {
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
			position: {lat: $(rowDiv).data('latitude'), lng: $(rowDiv).data('longitude')},
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


	window.gapi_init = function () {
		$(document).ready(function(){
			// run
			authorize(function () {
				getSheetData('links', function(d){
					parseLinksSheetData(d);
					getSheetData('groups', parseGroupsSheetData);
				});
			});

			// group types select box event
			$('.grouptypes').change(function () {
				var curGroupType = $(this).val();
				filterList(curGroupType);
			});

			// group block click event
			$('.community_group_seeker').on('click', '.groupRow', function(){
				new google.maps.event.trigger( $(this).data('marker'), 'click' );
			});
		});
	};

	window.gmap_init = function(){
		gmap = new google.maps.Map(document.getElementById('mapContainer'), {
			center: {lat: 34.0204989, lng: -118.4117325},
			zoom: 9
		});
	};

})($);