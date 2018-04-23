#!/bin/bash

courses_file=courses_201702

cd technion-ug-info-fetcher
php courses_to_json.php || {
	cd ..
	echo 'courses_to_json failed'
	exit 1
}
cd ..

src_file=technion-ug-info-fetcher\$courses_file.json
dest_file=cheese-fork\$courses_file.js

echo -n 'var courses_from_rishum = ' > $dest_file
cat $src_file >> $dest_file
