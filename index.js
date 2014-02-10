GLOBAL.VERSION = require('./package.json').version;
GLOBAL.GLaDOS = require('./lib/GLaDOS');
require('./lib/webserver');
require('fs').readdir("./plugins", function(err, files) {
    files.forEach(function(fileName) {
        if(fileName === 'example.js') return;
        require('./plugins/' + fileName);
    });
});

/*
TODO:
    quiz
    wolfram ?
    duden ?
    rss ?

*/
