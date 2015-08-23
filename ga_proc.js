(function ($) {


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
		'gsx$description': {type: 'text', sel: '.infoDescription'}
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
	var getSheetsData = function (sheetId, clb) {
		var token = gapi.auth.getToken();
		var accessToken = token['access_token'];
		var spreadSheetId = '10l5ejQ_19dVvr_R0uNMhT5svINJdht4SZFEKj5L0WJ0';
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
			$.each(data, function (colName, obj) {
				if (groupSheetColumnsAssign[colName]) {
					var colParams = groupSheetColumnsAssign[colName];
					var colValue = obj['$t'];
					switch (colParams['type']) {
						case 'text':
							rowDiv.find(colParams.sel).text(colValue);
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
				}
				if (colName == 'gsx$grouptype') {
					groupTypes[obj['$t']] = obj['$t'];
					rowDiv.data('groupType', obj['$t']);
				}
				if (colName == 'gsx$latitude') {
					rowDiv.data('latitude', parseFloat(obj['$t']));
				}
				if (colName == 'gsx$longitude') {
					rowDiv.data('longitude', parseFloat(obj['$t']));
				}
			});

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
	};

	/**
	 * filtering groups list
	 * @param groupType - group type
	 */
	var filterList = function (groupType) {
		if (groupType) {
			$('.groupRow').each(function (i, v) {
				if ($(v).data('groupType') == groupType) {
					$(v).show();
				} else {
					$(v).hide();
				}
			});
		} else {
			$('.groupRow').show();
		}
	};

	$(document).ready(function(){
		$('.grouptypes').change(function () {
			var curGroupType = $(this).val();
			filterList(curGroupType);
		});
	});



	window.gapi_init = function () {
		// run
		authorize(function () {
			getSheetsData(1, parseGroupsSheetData);
		});
	};

})($);