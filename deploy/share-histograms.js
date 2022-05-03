let cheeseforkShareHistograms = function () {
    'use strict';

    const histogramCategories = [
        'Exam_A',
        'Final_A',
        'Exam_B',
        'Final_B',
        'Exam_C',
        'Final_C',
        'Finals'
    ];
    let histogramUploadQueue = [];

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function uiCreateTable(courses) {
        let html = '<div class="HeaderWarp"><div id="grabber_title">' +
            'שיתוף היסטוגרמות: טוען נתונים...' +
            '</div></div><br>' +
            '<a href="#" class="btn btn-default btn-sm histogram" id="grabber_submit_button" style="background-color:#a5cd4e;display:none;">' +
            '<i class="fas fa-chart-line fa-lg"></i>&nbsp;' +
            'לחצו כאן לשיתוף ההיסטוגרמות' +
            '</a>' +
            '<a href="#" class="btn btn-default btn-sm histogram" id="grabber_try_again_button" style="background-color:#a5cd4e;display:none;">' +
            '<i class="fas fa-chart-line fa-lg"></i>&nbsp;' +
            'נסה שוב' +
            '</a>' +
            '<table class="tab tablesorter-ice">' +
            '<thead><tr>' +
            '<th>סמסטר</th>' +
            '<th>קורס</th>' +
            '<th>שם קורס</th>' +
            '<th>סגל</th>' +
            '<th>מבחן מועד א\'</th>' +
            '<th>סופי מועד א\'</th>' +
            '<th>מבחן מועד ב\'</th>' +
            '<th>סופי מועד ב\'</th>' +
            '<th>מבחן מועד ג\'</th>' +
            '<th>סופי מועד ג\'</th>' +
            '<th>סופי</th>' +
            '</tr></thead>' +
            '<tbody>';

        for (const course of courses) {
            const className = 'grabber_course_' + course.semester + '_' + course.course;
            html += '<tr class="' + className + '">' +
                '<td>' + escapeHtml(course.semesterPretty) + '</td>' +
                '<td>' + escapeHtml(course.course) + '</td>' +
                '<td>' + escapeHtml(course.name) + '</td>';

            html += '<td class="Staff">...</td>';

            for (const category of histogramCategories) {
                html += '<td class="' + category + '">...</td>';
            }

            html += '</tr>';
        }

        html += '</tbody></table>';

        document.getElementById('contents').innerHTML = html;
    }

    function uiUpdateTitle(title) {
        document.getElementById('grabber_title').textContent = 'שיתוף היסטוגרמות: ' + title;
    }

    function uiUpdateItemStatus(semester, course, category, status) {
        const className = 'grabber_course_' + semester + '_' + course;
        const node = document.querySelector('tr.' + className + ' td.' + category);
        node.textContent = status;
    }

    function uiAddCourseCategories(semester, course, categories) {
        let status = '📁';
        uiUpdateItemStatus(semester, course, 'Staff', status);

        for (const category of histogramCategories) {
            if (categories.includes(category)) {
                status = '📁';
            } else {
                status = '➖';
            }
            uiUpdateItemStatus(semester, course, category, status);
        }
    }

    function uiOnFirstLoadingDone() {
        uiUpdateTitle('מוכן');

        const submitButton = document.getElementById('grabber_submit_button');
        submitButton.style.display = 'inline-block';
        submitButton.onclick = () => {
            submitButton.style.display = 'none';
            uiUpdateTitle('משתף...');
            submitHistograms().catch(reason => uiOnError(reason.message));
            return false;
        };
    }

    function uiOnError(message) {
        alert('Error: ' + message);
        uiUpdateTitle('שגיאה');

        const tryAgainButton = document.getElementById('grabber_try_again_button');
        tryAgainButton.style.display = 'inline-block';
        tryAgainButton.onclick = () => {
            tryAgainButton.style.display = 'none';
            uiUpdateTitle('טוען נתונים...');
            run().catch(reason => uiOnError(reason.message));
            return false;
        };
    }

    function uiOnSubmitDone() {
        uiUpdateTitle('השיתוף הושלם');
    }

    function getCourses() {
        let courses = [];
        for (const node of document.querySelectorAll('a.ga-course')) {
            const url = node.href.replace(/\/contentEng\.aspx\b/, '/content.aspx');
            const semesterPretty = node.getAttribute('data-sem');
            const semesterArray = semesterPretty.split('/', 2);
            const semester = semesterArray[1] + semesterArray[0];
            const match = /^\s*\d+\s+(\d{5,8})\s+(.*?)\s*$/.exec(node.textContent);
            // For some reason, sometimes there are 8-digit course numbers,
            // in which case the last two digits have an extra, unknown meaning.
            const courseBeforePadding = match[1].length > 6 ? match[1].slice(0, -2) : match[1];
            const course = ('00000' + courseBeforePadding).slice(-6);
            const name = match[2];

            courses.push({
                url,
                semesterPretty,
                semester,
                course,
                name
            });
        }

        return courses;
    }

    function getCourseHistogramsFromHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let histograms = [];
        for (const node of doc.querySelectorAll('table#cBody_GV_StudentGrade tbody tr')) {
            const category = node.children[4].textContent;
            if (histogramCategories.includes(category)) {
                const histogramLink = node.querySelector('a[data-histogram]');
                if (histogramLink) {
                    const url = histogramLink.href.replace(/&lang=[a-z]+$/, '');
                    histograms.push({
                        category,
                        url
                    });
                }
            }
        }

        // Sometimes the Finals histogram exists only in the lower statistics table.
        if (histograms.every(x => x.category !== 'Finals')) {
            for (const node of doc.querySelectorAll('#cBody_PanelCourseStatistic tbody tr')) {
                const taskName = node.children[3].textContent;
                const category = node.children[4].textContent;
                if (taskName === 'ציון סופי במחשב המרכזי' && category === 'Finals') {
                    const histogramLink = node.querySelector('a[data-histogram]');
                    if (histogramLink) {
                        const url = histogramLink.href.replace(/&lang=[a-z]+$/, '');
                        histograms.push({
                            category,
                            url
                        });
                    }
                }
            }
        }

        histograms.sort((a, b) => histogramCategories.indexOf(a.category) - histogramCategories.indexOf(b.category));
        return histograms;
    }

    function getStaffFromHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let staff = [];
        for (const node of doc.querySelectorAll('table#cBody_GridView_Advisors tbody tr')) {
            staff.push({
                name: node.children[2].textContent.trim(),
                email: node.children[3].textContent.trim(),
                title: node.children[4].textContent.trim()
            });
        }

        return staff;
    }

    function getCourseHistogramFromHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Example:
        // בקורס - מבוא להסתברות ח' במשימה : ציון סופי במחשב המרכזי
        const match = /^בקורס - (.*?) במשימה : (.*)$/.exec(doc.querySelector('title').textContent.trim());
        const courseName = match ? match[1] : null;
        const categoryRaw = match ? match[2] : null;
        const category = categoryRaw === 'ציון סופי במחשב המרכזי' ? 'Finals' : categoryRaw;

        const imgSrc = doc.querySelector('img#CourseChart').src;
        const propertyNodes = doc.querySelectorAll('table#gvChart tbody td');
        const n = propertyNodes;
        const properties = {
            students: n[5] ? n[5].textContent : '',
            passFail: n[6] ? n[6].textContent : '',
            passPercent: n[7] ? n[7].textContent : '',
            min: n[9] ? n[9].textContent : '',
            max: n[10] ? n[10].textContent : '',
            average: n[11] ? n[11].textContent : '',
            median: n[12] ? n[12].textContent : ''
        };

        return {
            courseName,
            category,
            imgSrc,
            properties
        };
    }

    async function submitToGithub(course, semester, category, suffix, buffer, options = {}) {
        function calcGitFileSha(content) {
            let shaObj = new jsSHA('SHA-1', 'ARRAYBUFFER');
            shaObj.update(new TextEncoder().encode('blob ' + content.byteLength + '\0').buffer);
            shaObj.update(content);
            return shaObj.getHash('HEX');
        }

        function getGithubToken() {
            const tokens = [
                atob('Y2ViMTY5ZWM2YzAyYzY5ZDVmOTk2NjA5MmVkZWZkOTRiZGY2YjI2Yw=='),
                atob('NTNjNzA3MDc2NzM5MDJkYjI5ZGMzZTkxN2JlODdmNWI4YTMzZDdjNg=='),
                atob('MTA4MjQxYTJkYmNkYmZkZDQ2YWI0NDliZTJkZTVmMTYxZGZiZThhZQ=='),
                atob('NTllNTJhNTg1NTZiMWEzZjJmYmZjZjYyMjU3ZGM0OGY1YWQwY2ZkZg=='),
                atob('OWE4MmYzNjMwZjBlODQ1MWE2MDkwZjZhNjlkOWU3ZGQ4YmQ4MmYyYg==')
            ];
            return tokens[Math.floor(Math.random() * tokens.length)];
        }

        async function getGitFileSha(path, filename, token) {
            const url = 'https://api.github.com/repos/michael-maltsev/technion-histograms/git/trees/master:' +
                encodeURIComponent(path) +
                '?t=' + Date.now();

            const response = await fetch(url, {
                headers: {
                    // Rate limiting: Authenticated requests get a higher rate limit.
                    // https://developer.github.com/v3/#rate-limiting
                    'Authorization': 'token ' + token
                }
            });
            if (response.status === 200) {
                const data = await response.json();
                const item = data.tree.find(function (item) {
                    return item.path === filename;
                });

                return item ? item.sha : null;
            } else if (response.status === 404) {
                // No such folder.
                return null;
            } else {
                throw new Error('Get tree API returned ' + response.status);
            }
        }

        // https://stackoverflow.com/a/9458996
        function arrayBufferToBase64(buffer) {
            let binary = '';
            let bytes = new Uint8Array(buffer);
            let len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        }

        const fileSha = calcGitFileSha(buffer);
        if (fileSha === options.skipIfSha) {
            return 'skipped';
        }

        const filename = category + suffix;
        const path = course + '/' + semester;
        const token = getGithubToken();

        const serverSha = await getGitFileSha(path, filename, token);
        if (serverSha && (options.skipIfExists || serverSha === fileSha)) {
            return 'exists';
        }

        const url = 'https://api.github.com/repos/michael-maltsev/technion-histograms/contents/' +
            path + '/' + filename;

        const messagePrefix = serverSha ? 'Updated' : 'Added';
        let data = {
            message: `${messagePrefix} ${path}/${filename}`,
            content: arrayBufferToBase64(buffer)
        };
        if (serverSha) {
            data.sha = serverSha;
        }

        let attemptNum = 0;
        while (true) {
            attemptNum++;
            if (attemptNum >= 4) {
                // Sleep for up to 5 seconds.
                await new Promise(r => setTimeout(r, Math.floor(Math.random() * 5000)));
            }

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Authorization': 'token ' + token
                },
                body: JSON.stringify(data)
            });
            if (response.status === 409) {
                // 409 Conflict, submissions are too fast, try again.
                // https://github.com/pyupio/pyup/issues/5
            } else if (response.status === 200) {
                return 'updated';
            } else if (response.status === 201) {
                return 'created';
            } else {
                throw new Error('Put file API returned ' + response.status);
            }
        }
    }

    async function fetchValidResponse(url, name) {
        let lastStatus;
        for (let i = 0; i < 4; i++) {
            const result = await fetch(url);
            if (result.ok) {
                return result;
            }

            lastStatus = result.status;
        }

        throw new Error(`Fetching ${name} returned ` + lastStatus);
    }

    async function fetchValidResponseAsText(url, name, encoding) {
        const response = await fetchValidResponse(url, name);
        if (!encoding) {
            return await response.text();
        }

        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder(encoding);
        return decoder.decode(buffer);
    }

    async function submitHistograms() {
        for (const {course, semester, url: courseUrl, name: courseName, histograms} of histogramUploadQueue) {
            uiUpdateItemStatus(semester, course, 'Staff', '...');

            const coursePageHtml = await fetchValidResponseAsText(courseUrl, 'course page', 'windows-1255');
            const staffArray = getStaffFromHtml(coursePageHtml);
            const staff = new TextEncoder().encode(JSON.stringify(staffArray, null, 2)).buffer;
            const skipIfExists = staffArray.length === 0;
            const staffResult = await submitToGithub(course, semester, 'Staff', '.json', staff, { skipIfExists });

            if (staffResult === 'exists') {
                uiUpdateItemStatus(semester, course, 'Staff', '⚌');
            } else {
                uiUpdateItemStatus(semester, course, 'Staff', '✔');
            }

            for (const {category, url: histogramUrl} of histograms) {
                uiUpdateItemStatus(semester, course, category, '...');

                const histogramPageHtml = await fetchValidResponseAsText(histogramUrl, 'histogram page', 'windows-1255');
                const histogram = getCourseHistogramFromHtml(histogramPageHtml);

                let propertiesResult = 'skipped';
                let imageResult = 'skipped';

                // The histogram course name might not match. This can happen if a different course page was loaded before loading the histogram page.
                // The server determines which course's histogram to show according to the last viewed course page.
                // The course is saved in a server session once the course page is loaded, and the histogram page URL is the same for all courses.
                // Awful design, and the best we can do is try to detect this and refuse to upload the details of the wrong course.
                // The image URL is unique for that histogram page, so there's no such problem with it, and the check that we do is enough.
                // We allow an empty course name just in case it can happen (perhaps we don't detect all possible formats).

                if ((!histogram.courseName || histogram.courseName === courseName) && (!histogram.category || histogram.category === category)) {
                    // Don't override with empty data (might happen sometimes because of an error or tests)
                    const skipIfExists = Object.values(histogram.properties).every(x => !x);

                    const properties = new TextEncoder().encode(JSON.stringify(histogram.properties, null, 2)).buffer;
                    propertiesResult = await submitToGithub(course, semester, category, '.json', properties, { skipIfExists });

                    // Don't upload test images (stop testing in production!)
                    // Example:
                    // https://github.com/michael-maltsev/technion-histograms/blob/f985c9133f4b5858e3b9605707fad6a913842e12/104013/201802/Final_B.png
                    const skipIfSha = '69c39015341c48540ef07afdd45252696987b212';

                    const image = await (await fetchValidResponse(histogram.imgSrc, 'histogram image')).arrayBuffer();
                    imageResult = await submitToGithub(course, semester, category, '.png', image, { skipIfSha });
                }

                if (propertiesResult === 'skipped' || imageResult === 'skipped') {
                    uiUpdateItemStatus(semester, course, category, '⚠');
                } else if (propertiesResult === 'exists' && imageResult === 'exists') {
                    uiUpdateItemStatus(semester, course, category, '⚌');
                } else {
                    uiUpdateItemStatus(semester, course, category, '✔');
                }
            }
        }

        uiOnSubmitDone();
    }

    async function run() {
        const courses = getCourses();
        uiCreateTable(courses);

        for (const {course, semester, url, name} of courses) {
            const html = await fetchValidResponseAsText(url, 'course page', 'windows-1255');
            const histograms = getCourseHistogramsFromHtml(html);

            histogramUploadQueue.push({
                course,
                semester,
                url,
                name,
                histograms
            });

            const categories = histograms.map(x => x.category);
            uiAddCourseCategories(semester, course, categories);
        }

        uiOnFirstLoadingDone();
    }

    run().catch(reason => uiOnError(reason.message));
};

// jsSHA v3.1.2
// https://github.com/Caligatio/jsSHA/blob/8698dace2ff9fd1338aa67b537de8517a4c8e57f/dist/sha1.js

/**
 * A JavaScript implementation of the SHA family of hashes - defined in FIPS PUB 180-4, FIPS PUB 202,
 * and SP 800-185 - as well as the corresponding HMAC implementation as defined in FIPS PUB 198-1.
 *
 * Copyright 2008-2020 Brian Turek, 1998-2009 Paul Johnston & Contributors
 * Distributed under the BSD License
 * See http://caligatio.github.com/jsSHA/ for more information
 *
 * Two ECMAScript polyfill functions carry the following license:
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
 * MERCHANTABLITY OR NON-INFRINGEMENT.
 *
 * See the Apache Version 2.0 License for specific language governing permissions and limitations under the License.
 */
!function(t,r){"object"==typeof exports&&"undefined"!=typeof module?module.exports=r():"function"==typeof define&&define.amd?define(r):(t=t||self).jsSHA=r()}(this,(function(){"use strict";var t=function(r,n){return(t=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(t,r){t.__proto__=r}||function(t,r){for(var n in r)r.hasOwnProperty(n)&&(t[n]=r[n])})(r,n)};var r="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";function n(t,r,n,i){var e,o,u,s=r||[0],f=(n=n||0)>>>3,h=-1===i?3:0;for(e=0;e<t.length;e+=1)o=(u=e+f)>>>2,s.length<=o&&s.push(0),s[o]|=t[e]<<8*(h+i*(u%4));return{value:s,binLen:8*t.length+n}}function i(t,i,e){switch(i){case"UTF8":case"UTF16BE":case"UTF16LE":break;default:throw new Error("encoding must be UTF8, UTF16BE, or UTF16LE")}switch(t){case"HEX":return function(t,r,n){return function(t,r,n,i){var e,o,u,s;if(0!=t.length%2)throw new Error("String of HEX type must be in byte increments");var f=r||[0],h=(n=n||0)>>>3,a=-1===i?3:0;for(e=0;e<t.length;e+=2){if(o=parseInt(t.substr(e,2),16),isNaN(o))throw new Error("String of HEX type contains invalid characters");for(u=(s=(e>>>1)+h)>>>2;f.length<=u;)f.push(0);f[u]|=o<<8*(a+i*(s%4))}return{value:f,binLen:4*t.length+n}}(t,r,n,e)};case"TEXT":return function(t,r,n){return function(t,r,n,i,e){var o,u,s,f,h,a,c,w,E=0,v=n||[0],A=(i=i||0)>>>3;if("UTF8"===r)for(c=-1===e?3:0,s=0;s<t.length;s+=1)for(u=[],128>(o=t.charCodeAt(s))?u.push(o):2048>o?(u.push(192|o>>>6),u.push(128|63&o)):55296>o||57344<=o?u.push(224|o>>>12,128|o>>>6&63,128|63&o):(s+=1,o=65536+((1023&o)<<10|1023&t.charCodeAt(s)),u.push(240|o>>>18,128|o>>>12&63,128|o>>>6&63,128|63&o)),f=0;f<u.length;f+=1){for(h=(a=E+A)>>>2;v.length<=h;)v.push(0);v[h]|=u[f]<<8*(c+e*(a%4)),E+=1}else for(c=-1===e?2:0,w="UTF16LE"===r&&1!==e||"UTF16LE"!==r&&1===e,s=0;s<t.length;s+=1){for(o=t.charCodeAt(s),!0===w&&(o=(f=255&o)<<8|o>>>8),h=(a=E+A)>>>2;v.length<=h;)v.push(0);v[h]|=o<<8*(c+e*(a%4)),E+=2}return{value:v,binLen:8*E+i}}(t,i,r,n,e)};case"B64":return function(t,n,i){return function(t,n,i,e){var o,u,s,f,h,a,c=0,w=n||[0],E=(i=i||0)>>>3,v=-1===e?3:0,A=t.indexOf("=");if(-1===t.search(/^[a-zA-Z0-9=+/]+$/))throw new Error("Invalid character in base-64 string");if(t=t.replace(/=/g,""),-1!==A&&A<t.length)throw new Error("Invalid '=' found in base-64 string");for(o=0;o<t.length;o+=4){for(f=t.substr(o,4),s=0,u=0;u<f.length;u+=1)s|=r.indexOf(f.charAt(u))<<18-6*u;for(u=0;u<f.length-1;u+=1){for(h=(a=c+E)>>>2;w.length<=h;)w.push(0);w[h]|=(s>>>16-8*u&255)<<8*(v+e*(a%4)),c+=1}}return{value:w,binLen:8*c+i}}(t,n,i,e)};case"BYTES":return function(t,r,n){return function(t,r,n,i){var e,o,u,s,f=r||[0],h=(n=n||0)>>>3,a=-1===i?3:0;for(o=0;o<t.length;o+=1)e=t.charCodeAt(o),u=(s=o+h)>>>2,f.length<=u&&f.push(0),f[u]|=e<<8*(a+i*(s%4));return{value:f,binLen:8*t.length+n}}(t,r,n,e)};case"ARRAYBUFFER":try{new ArrayBuffer(0)}catch(t){throw new Error("ARRAYBUFFER not supported by this environment")}return function(t,r,i){return function(t,r,i,e){return n(new Uint8Array(t),r,i,e)}(t,r,i,e)};case"UINT8ARRAY":try{new Uint8Array(0)}catch(t){throw new Error("UINT8ARRAY not supported by this environment")}return function(t,r,i){return n(t,r,i,e)};default:throw new Error("format must be HEX, TEXT, B64, BYTES, ARRAYBUFFER, or UINT8ARRAY")}}function e(t,n,i,e){switch(t){case"HEX":return function(t){return function(t,r,n,i){var e,o,u="",s=r/8,f=-1===n?3:0;for(e=0;e<s;e+=1)o=t[e>>>2]>>>8*(f+n*(e%4)),u+="0123456789abcdef".charAt(o>>>4&15)+"0123456789abcdef".charAt(15&o);return i.outputUpper?u.toUpperCase():u}(t,n,i,e)};case"B64":return function(t){return function(t,n,i,e){var o,u,s,f,h,a="",c=n/8,w=-1===i?3:0;for(o=0;o<c;o+=3)for(f=o+1<c?t[o+1>>>2]:0,h=o+2<c?t[o+2>>>2]:0,s=(t[o>>>2]>>>8*(w+i*(o%4))&255)<<16|(f>>>8*(w+i*((o+1)%4))&255)<<8|h>>>8*(w+i*((o+2)%4))&255,u=0;u<4;u+=1)a+=8*o+6*u<=n?r.charAt(s>>>6*(3-u)&63):e.b64Pad;return a}(t,n,i,e)};case"BYTES":return function(t){return function(t,r,n){var i,e,o="",u=r/8,s=-1===n?3:0;for(i=0;i<u;i+=1)e=t[i>>>2]>>>8*(s+n*(i%4))&255,o+=String.fromCharCode(e);return o}(t,n,i)};case"ARRAYBUFFER":try{new ArrayBuffer(0)}catch(t){throw new Error("ARRAYBUFFER not supported by this environment")}return function(t){return function(t,r,n){var i,e=r/8,o=new ArrayBuffer(e),u=new Uint8Array(o),s=-1===n?3:0;for(i=0;i<e;i+=1)u[i]=t[i>>>2]>>>8*(s+n*(i%4))&255;return o}(t,n,i)};case"UINT8ARRAY":try{new Uint8Array(0)}catch(t){throw new Error("UINT8ARRAY not supported by this environment")}return function(t){return function(t,r,n){var i,e=r/8,o=-1===n?3:0,u=new Uint8Array(e);for(i=0;i<e;i+=1)u[i]=t[i>>>2]>>>8*(o+n*(i%4))&255;return u}(t,n,i)};default:throw new Error("format must be HEX, B64, BYTES, ARRAYBUFFER, or UINT8ARRAY")}}function o(t){var r={outputUpper:!1,b64Pad:"=",outputLen:-1},n=t||{},i="Output length must be a multiple of 8";if(r.outputUpper=n.outputUpper||!1,n.b64Pad&&(r.b64Pad=n.b64Pad),n.outputLen){if(n.outputLen%8!=0)throw new Error(i);r.outputLen=n.outputLen}else if(n.shakeLen){if(n.shakeLen%8!=0)throw new Error(i);r.outputLen=n.shakeLen}if("boolean"!=typeof r.outputUpper)throw new Error("Invalid outputUpper formatting option");if("string"!=typeof r.b64Pad)throw new Error("Invalid b64Pad formatting option");return r}function u(t,r){return t<<r|t>>>32-r}function s(t,r,n){return t^r^n}function f(t,r,n){return t&r^t&n^r&n}function h(t,r){var n=(65535&t)+(65535&r);return(65535&(t>>>16)+(r>>>16)+(n>>>16))<<16|65535&n}function a(t,r,n,i,e){var o=(65535&t)+(65535&r)+(65535&n)+(65535&i)+(65535&e);return(65535&(t>>>16)+(r>>>16)+(n>>>16)+(i>>>16)+(e>>>16)+(o>>>16))<<16|65535&o}function c(t){return[1732584193,4023233417,2562383102,271733878,3285377520]}function w(t,r){var n,i,e,o,c,w,E,v,A=[];for(n=r[0],i=r[1],e=r[2],o=r[3],c=r[4],E=0;E<80;E+=1)A[E]=E<16?t[E]:u(A[E-3]^A[E-8]^A[E-14]^A[E-16],1),w=E<20?a(u(n,5),(v=i)&e^~v&o,c,1518500249,A[E]):E<40?a(u(n,5),s(i,e,o),c,1859775393,A[E]):E<60?a(u(n,5),f(i,e,o),c,2400959708,A[E]):a(u(n,5),s(i,e,o),c,3395469782,A[E]),c=o,o=e,e=u(i,30),i=n,n=w;return r[0]=h(n,r[0]),r[1]=h(i,r[1]),r[2]=h(e,r[2]),r[3]=h(o,r[3]),r[4]=h(c,r[4]),r}function E(t,r,n,i){for(var e,o=15+(r+65>>>9<<4),u=r+n;t.length<=o;)t.push(0);for(t[r>>>5]|=128<<24-r%32,t[o]=4294967295&u,t[o-1]=u/4294967296|0,e=0;e<t.length;e+=16)i=w(t.slice(e,e+16),i);return i}return function(r){function n(t,n,e){var o=this;if("SHA-1"!==t)throw new Error("Chosen SHA variant is not supported");var u=e||{};return(o=r.call(this,t,n,e)||this).t=!0,o.i=o.o,o.u=-1,o.s=i(o.h,o.v,o.u),o.A=w,o.p=function(t){return t.slice()},o.l=c,o.R=E,o.U=[1732584193,4023233417,2562383102,271733878,3285377520],o.T=512,o.m=160,o.F=!1,u.hmacKey&&o.B(function(t,r,n,e){var o=t+" must include a value and format";if(!r){if(!e)throw new Error(o);return e}if(void 0===r.value||!r.format)throw new Error(o);return i(r.format,r.encoding||"UTF8",n)(r.value)}("hmacKey",u.hmacKey,o.u)),o}return function(r,n){function i(){this.constructor=r}t(r,n),r.prototype=null===n?Object.create(n):(i.prototype=n.prototype,new i)}(n,r),n}(function(){function t(t,r,n){var i=n||{};if(this.h=r,this.v=i.encoding||"UTF8",this.numRounds=i.numRounds||1,isNaN(this.numRounds)||this.numRounds!==parseInt(this.numRounds,10)||1>this.numRounds)throw new Error("numRounds must a integer >= 1");this.g=t,this.Y=[],this.I=0,this.C=!1,this.H=0,this.L=!1,this.N=[],this.S=[]}return t.prototype.update=function(t){var r,n=0,i=this.T>>>5,e=this.s(t,this.Y,this.I),o=e.binLen,u=e.value,s=o>>>5;for(r=0;r<s;r+=i)n+this.T<=o&&(this.U=this.A(u.slice(r,r+i),this.U),n+=this.T);this.H+=n,this.Y=u.slice(n>>>5),this.I=o%this.T,this.C=!0},t.prototype.getHash=function(t,r){var n,i,u=this.m,s=o(r);if(this.F){if(-1===s.outputLen)throw new Error("Output length must be specified in options");u=s.outputLen}var f=e(t,u,this.u,s);if(this.L&&this.i)return f(this.i(s));for(i=this.R(this.Y.slice(),this.I,this.H,this.p(this.U),u),n=1;n<this.numRounds;n+=1)this.F&&u%32!=0&&(i[i.length-1]&=16777215>>>24-u%32),i=this.R(i,u,0,this.l(this.g),u);return f(i)},t.prototype.setHMACKey=function(t,r,n){if(!this.t)throw new Error("Variant does not support HMAC");if(this.C)throw new Error("Cannot set MAC key after calling update");var e=i(r,(n||{}).encoding||"UTF8",this.u);this.B(e(t))},t.prototype.B=function(t){var r,n=this.T>>>3,i=n/4-1;if(1!==this.numRounds)throw new Error("Cannot set numRounds with MAC");if(this.L)throw new Error("MAC key already set");for(n<t.binLen/8&&(t.value=this.R(t.value,t.binLen,0,this.l(this.g),this.m));t.value.length<=i;)t.value.push(0);for(r=0;r<=i;r+=1)this.N[r]=909522486^t.value[r],this.S[r]=1549556828^t.value[r];this.U=this.A(this.N,this.U),this.H=this.T,this.L=!0},t.prototype.getHMAC=function(t,r){var n=o(r);return e(t,this.m,this.u,n)(this.o())},t.prototype.o=function(){var t;if(!this.L)throw new Error("Cannot call getHMAC without first setting MAC key");var r=this.R(this.Y.slice(),this.I,this.H,this.p(this.U),this.m);return t=this.A(this.S,this.l(this.g)),t=this.R(r,this.m,this.T,t,this.m)},t}())}));

// 🧀🍴
cheeseforkShareHistograms();
