#!/bin/bash

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

fetch_semester 202002 || exit 1
fetch_semester 202003 || exit 1
fetch_semester 202101 || exit 1
