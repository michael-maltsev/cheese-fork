#!/bin/bash

courses_file=courses_201702

cd technion-ug-info-fetcher
php courses_to_json.php || {
	cd ..
	echo courses_to_json failed
	exit 1
}
cd ..

src_file=technion-ug-info-fetcher/$courses_file.json
dest_file_min=deploy/$courses_file.min.js
dest_file=deploy/$courses_file.js

echo -n 'var courses_from_rishum = ' > $dest_file_min
cat $src_file >> $dest_file_min

echo -n 'var courses_from_rishum = ' > $dest_file
php_cmd="echo json_encode(json_decode(file_get_contents('$src_file')), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);"
php -r "$php_cmd" >> $dest_file
