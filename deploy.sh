#!/bin/bash

semester_1=202201
semester_2=202202
semester_3=202203
semester_next=202301

function technion_url_get {
	local url=$1
	if [[ -z "${COURSE_INFO_FETCHER_PROXY_URL}" ]] && [[ -z "${COURSE_INFO_FETCHER_PROXY_AUTH}" ]]; then
		curl -s -x "$COURSE_INFO_FETCHER_PROXY" "$url"
	else
		curl -s "$COURSE_INFO_FETCHER_PROXY_URL" --header "Proxy-Auth: $COURSE_INFO_FETCHER_PROXY_AUTH" --header "Proxy-Target-URL: $url"
	fi
}

function semester_available {
	local semester=$1
	echo Checking semester $semester availability...

	technion_url_get 'https://students.technion.ac.il/local/technionsearch/search' | grep -qF 'name="semesterscheckboxgroup['$semester']"'
}

function fetch_semester {
	local semester=$1
	echo Fetching semester $semester...

	local courses_file=courses_$semester

	cd technion-ug-info-fetcher
	php courses_to_json.php --semester "$semester" --verbose --simultaneous_downloads 16 || {
		cd ..
		echo courses_to_json failed
		return 1
	}
	cd ..

	local src_file=technion-ug-info-fetcher/$courses_file.json
	local dest_file_min=deploy/courses/$courses_file.min.js
	local dest_file=deploy/courses/$courses_file.js

	echo -n "var courses_from_rishum = JSON.parse('" > $dest_file_min
	local php_cmd="echo addcslashes(file_get_contents('$src_file'), '\\\\\\'');"
	php -r "$php_cmd" >> $dest_file_min
	echo -n "')" >> $dest_file_min

	echo -n 'var courses_from_rishum = ' > $dest_file
	local php_cmd="echo json_encode(json_decode(file_get_contents('$src_file')), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);"
	php -r "$php_cmd" >> $dest_file

	return 0
}

# Check semester availability.
semester_available $semester_1 || exit 1
semester_available $semester_2 || exit 1
semester_available $semester_3 || exit 1
semester_available $semester_next && exit 1

# Fetch last three semesters.
fetch_semester $semester_1 || exit 1
fetch_semester $semester_2 || exit 1
fetch_semester $semester_3 || exit 1

echo Done

exit 0
