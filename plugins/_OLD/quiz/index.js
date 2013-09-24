module.exports = {
    /*==========[ +INFO+ ]==========*/
    info: {
        description: "Bietet Quiz-Funktionen für den Channel.",
        commands: ["{C}quiz <START/STOP/NEXT>"]
    },
    /*==========[ -INFO- ]==========*/

    questions: require('./questions-de.js'),
    rules: ["Keine Suchmaschinen(Google/Bing/Yahoo/etc.)", "Raten ist erlaubt, solange es nicht in Spam ausartet"],
    active: false,
    wait: false,
    activeQuestion: null,
    questionDelay: 5,
    qString: "",
    intervalId: null,
    tippDelay: 30,
    tippCount: 0,
    maxTipps: 5,
    frageNum: -1,
    channel: "#quiz",
    postTops: 0,
    revolte: {
        needed: -1,
        has: []
    },

    getScore: function(nick, fn) {
        REDISDB.hget("quiz", nick, function (err, obj) {
            fn(obj || 0);
        });
    },
    addScore: function(nick) {
        this.getScore(nick, function(score) {
            REDISDB.hset("quiz", nick, score+1);
        });
    },
    getTopList: function(fn) {
        REDISDB.hgetall("quiz", function (err, obj) {
            var _scores = obj || {};
            var scores = [];
            Object.keys(_scores).forEach(function(nick) {
                var score = _scores[nick];
                scores.push({
                    "nick": nick,
                    "score": score
                });
            });
            scores.sort(function(a,b) {
                return b.score - a.score;
            });
            var max = [];
            scores.forEach(function(val) {
                max.push(val.nick + " ("+val.score+")");
            });
            fn(max.join(", "));
        });
    },
    right: function(client, user) {
        if(!this.active) return;
        var nick = user.getNick();
        this.addScore(nick);
        this.questions[ this.frageNum ].alreadyAsked = true;
        this.questions[ this.frageNum ].answered = true;
        client.say(this.channel, "[\u0002QUIZ\u000f] " + nick + " hat die richtige Antwort gewusst! Die richtige Antwort war: " + this.activeQuestion.Answer.replace(/\#/g,'') );
        this.stopTipps();
        this.wait = true;
        this.postTopList(client);
        var that = this;
        setTimeout(function() {
            that.showQuestion(client);
        }, this.questionDelay*1000);
    },
    showQuestion: function(client) {
        if(!this.active) return;
        this.tippCount = 0;
        this.wait = false;
        var frageNum = Math.round( 1 + ( Math.random() * ( Object.keys(this.questions).length - 1 ) ) );
        while(this.questions[ frageNum ].answered === false) {
            frageNum = Math.round( 1 + ( Math.random() * ( Object.keys(this.questions).length - 1 ) ) );
        }
        this.qString = this.start(frageNum);
        client.say(this.channel, "[\u0002QUIZ\u000f] " + this.qString);
        this.startTipps(client);
        this.revolte.needed = -1;
        this.revolte.has = [];
    },
    showNextQuestion: function(client, frageNum) {
        if(!this.active) return;
        this.tippCount = 0;
        this.wait = false;
        this.qString = this.start(frageNum);
        client.say(this.channel, "[\u0002QUIZ\u000f] " + this.qString);
        this.startTipps(client);
        this.revolte.needed = -1;
        this.revolte.has = [];
    },
    start: function(frageNum) {
        this.frageNum = frageNum;
        var questionString = "";

        this.active = true;

        //this.questions[ frageNum ].alreadyAsked = true;
        //this.questions[ frageNum ].answered = false;

        this.activeQuestion = this.questions[ frageNum ];

        //console.log( frageNum );
        //console.log( this.questions[ frageNum ] );

        questionString = "[Frage: " + frageNum + "]";

        if ( typeof this.questions[ frageNum ].Category !== 'undefined' ) {
            questionString += " [Kategorie: " + this.questions[ frageNum ].Category + "]";
        }
        if ( typeof this.questions[ frageNum ].Level !== 'undefined' ) {
            questionString += " [Level: " + this.questions[ frageNum ].Level + "]";
        }
        questionString += " " + this.questions[ frageNum ].Question;

        return questionString;
    },
    startTipps: function(client) {
        if(!this.active) return;
        var that = this;

        this.intervalId = setInterval(function() {
            if(that.intervalId == -1) return;
            that.tippCount++;
            if( that.tippCount === 1 && typeof that.activeQuestion.Tip !== 'undefined' ) {
                client.say(that.channel, "[\u0002QUIZ\u000f] [Tip " + that.tippCount + "] " + that.activeQuestion.Tip);
            }
            else if( that.tippCount > that.maxTipps || that.tippCount > that.activeQuestion.Answer.replace(/\#/g,'').length ) {
                that.stopTipps();
                that.noRightAnswer(client);
            }
            else {
                var tipp = "";
                var string = that.activeQuestion.Answer.replace(/\#/g,'');
                var splitEvery = that.maxTipps;
                var match =  '.{1,' + splitEvery + '}';
                var re = new RegExp(match, 'g');
                var parts = string.match(re);
                for(var p=0; p<parts.length; p++) {
                    var part = parts[p];
                    for(var j=0; j<part.length; j++) {
                        if(j+1 <= that.tippCount) {
                            tipp += part.charAt(j);
                        }
                        else {
                            if( part.charAt(j) == " " ) {
                                tipp += ' ';
                            } else {
                                tipp += '_';
                            }
                        }
                        tipp += ' ';
                    }
                }
                client.say(that.channel, "[\u0002QUIZ\u000f] [Tip " + that.tippCount + "] " + tipp);
            }
        }, this.tippDelay*1000);
    },
    noRightAnswer: function(client) {
        if(!this.active) return;
        client.say(this.channel, "[\u0002QUIZ\u000f] Die Zeit ist um. Niemand hat die richtige antwort gewusst!");
        client.say(this.channel, "[\u0002QUIZ\u000f] Aber um trotzdem noch etwas für eure Allgemeinbildung zu tun; Die richte Antwort war: " + this.activeQuestion.Answer.replace(/\#/g,''));
        client.say(this.channel, "[\u0002QUIZ\u000f] Die nächste Frage folgt in " + this.questionDelay + " Sekunden.");
        this.stopTipps();
        this.questions[ this.frageNum ].alreadyAsked = true;
        this.wait = true;
        this.postTopList(client);
        var that = this;
        setTimeout(function() {
            that.showQuestion(client);
        }, this.questionDelay*1000);
    },
    postTopList: function(client) {
        this.postTops++;
        if(this.postTops >= 5) {
            this.postTops = 0;
            this.getTopList(function(list) {
                client.say(this.channel, "[\u0002QUIZ\u000f] Toplist: " + list);
            });
        }
    },
    stop: function() {
        this.stopTipps();
        this.active = false;
    },
    stopTipps: function() {
        clearInterval(this.intervalId);
        this.intervalId = -1;
    },
    checkAnswer: function(message) {
        var answer = this.activeQuestion.Answer;
        message = message.toLowerCase();
        if( message.search( answer.replace(/\#/g,'').toLowerCase() ) !== -1 ) return true;

        var tr = {"ä":"ae", "ü":"ue", "ö":"oe", "ß":"ss" };
        if( message.replace(/[äöüß]/g, function($0) { return tr[$0]; }).search( answer.replace(/\#/g,'').toLowerCase().replace(/[äöüß]/g, function($0) { return tr[$0]; }) ) !== -1 ) return true;

        return false;
    },

    onJoin: function(client, server, channel, user) {
        if(channel.getName() == this.channel && this.active) {
            client.notice(user.getNick(), "Willkommen in " + channel.getName() + ", " + user.getNick() + "! In diesem Channel wird zur Zeit Quiz gespielt. Mehr Informationen erhälst du per '" + CONFIG.get('commandChar') + "quizhelp'.");
        }
    },
    onChannelMessage: function(client, server, channel, user, message) {
        if(channel.getName() == this.channel && this.active && !this.wait) {
            var answer = this.activeQuestion.Answer;
            if( typeof this.activeQuestion.Regexp !== 'undefined' ) {
                var regex = this.activeQuestion.Regexp;
                var re = new RegExp(regex, 'i');
                if( message.toLowerCase().match(re) ) {
                    this.right(client, user);
                }
            }
            else {
                if( this.checkAnswer(message) ) {
                    this.right(client, user);
                }
            }
        }
    },
    onCommand: function(client, server, channel, commandChar, name, params, user, text, message) {
        if(name == "quiz") {
            if(!user.hasPermissions()) return client.notice(user.getNick(), "Du hast nicht die nötigen rechte dazu.");
            if(this.channel != channel.getName()) return client.notice(user.getNick(), "Du musst im Channel '" + this.channel + "' sein.");
            if(params.length === 0) return client.notice(user.getNick(), commandChar + name + " <START/STOP/NEXT>");
            if(params[0].toLowerCase() == "start") {
                if(this.active) return client.notice(user.getNick(), "Das Quiz läuft bereits.");
                if(this.channel !== null && channel.getName() != this.channel) return client.notice(user.getNick(), "Das Quiz läuft bereits in einem anderen Channel.");
                client.say(channel.getName(), "[\u0002QUIZ\u000f] " + user.getNick() + " hat das Quiz gestartet!");
                client.say(channel.getName(), "[\u0002QUIZ\u000f] Meine Datenbank umfasst " + Object.keys(this.questions).length + " Fragen.");
                client.say(channel.getName(), "[\u0002QUIZ\u000f] Die erste Frage folgt in " + this.questionDelay + " Sekunden.");
                this.active = true;
                this.stopTipps();
                this.wait = true;
                var that = this;
                setTimeout(function() {
                    that.showQuestion(client, channel);
                }, this.questionDelay*1000);
            }
            else if(params[0].toLowerCase() == "stop") {
                if(!user.hasPermissions()) return client.notice(user.getNick(), "Du hast nicht die nötigen rechte dazu.");
                if(this.channel != channel.getName()) return client.notice(user.getNick(), "Du musst im Channel '" + this.channel + "' sein.");
                if(!this.active) return client.notice(user.getNick(), "Zur Zeit läuft kein Quiz.");
                if(channel.getName() != this.channel) return client.notice(user.getNick(), "In diesem Channel läuft kein Quiz.");
                this.active = false;
                this.stop();
                client.say(channel.getName(), "[\u0002QUIZ\u000f] " + user.getNick() + " hat das Quiz gestoppt!");
            }
            else if(params[0].toLowerCase() == "next") {
                if(!user.hasPermissions()) return client.notice(user.getNick(), "Du hast nicht die nötigen rechte dazu.");
                if(this.channel != channel.getName()) return client.notice(user.getNick(), "Du musst im Channel '" + this.channel + "' sein.");
                if(!this.active) return client.notice(user.getNick(), "Zur Zeit läuft kein Quiz.");
                if(channel.getName() != this.channel) return client.notice(user.getNick(), "In diesem Channel läuft kein Quiz.");
                client.say(channel.getName(), "[\u0002QUIZ\u000f] Diese Frage wird übersprungen.");
                if(params.length == 1) {
                    this.stopTipps();
                    this.wait = true;
                    var _that = this;
                    setTimeout(function() {
                        _that.showQuestion(client);
                    }, this.questionDelay*1000);
                }
                else if(params.length > 1) {
                    var id = parseInt(params[1], 10);
                    this.stopTipps();
                    this.wait = true;
                    var __that = this;
                    setTimeout(function() {
                        __that.showNextQuestion(client,id);
                    }, this.questionDelay*1000);
                }
            }
            return true;
        }
        else if(name == "frage") {
            if(this.channel != channel.getName()) return client.notice(user.getNick(), "Du musst im Channel '" + this.channel + "' sein.");
            if(!this.active || this.channel === null) return client.notice(user.getNick(), "Zur Zeit läuft kein Quiz.");
            if(this.wait) return client.notice(user.getNick(), "Es wurde noch keine neue Frage gestellt. Bitte gedulde dich einen Augenblick.");
            client.notice(user.getNick(), "Die aktuelle frage ist: " + this.qString);
            return true;
        }
        else if(name == "quizhelp") {
            if(this.channel != channel.getName()) return client.notice(user.getNick(), "Du musst im Channel '" + this.channel + "' sein.");
            if(!this.active) return client.notice(user.getNick(), "Zur Zeit läuft kein Quiz.");
            client.notice(user.getNick(), "In diesem Channel wird Quiz gespielt. Es gelten folgende Regeln:");
            for(var i=0; i<this.rules.length; i++) {
                client.notice(user.getNick(), "    $" + (i+1) + " - " + this.rules[i]);
            }
            client.notice(user.getNick(), "Wenn du nicht bis zur nächsten Frage warten möchtest, kannst du '" + CONFIG.get('commandChar') + "frage' nutzen um die aktuelle Frage zu erhalten.");
            client.notice(user.getNick(), "Mit '" + CONFIG.get('commandChar') + "quizscore' erhälst du deine aktuelle Punktzahl.");
            client.notice(user.getNick(), "Viel Spaß beim Quizzen! :)");
            return true;
        }
        else if(name == "quizscore") {
            if(this.channel != channel.getName()) return client.notice(user.getNick(), "Du musst im Channel '" + this.channel + "' sein.");
            var _nick = user.getNick();
            this.getScore(_nick, function(score) {
                client.notice(user.getNick(), "Du hast " + score + " Fragen richtig beantwortet.");
            });
            this.getTopList(function(toplist) {
                client.notice(user.getNick(), "Toplist: " + toplist);
            });
            return true;
        }
        else if(name == "revolte") {
            if(this.channel != channel.getName()) return client.notice(user.getNick(), "Du musst im Channel '" + this.channel + "' sein.");
            if(!this.active) return client.notice(user.getNick(), "Zur Zeit läuft kein Quiz.");
            if(this.tippCount < 1) return client.notice(user.getNick(), "Ich reagiere nicht auf Revolten wenn nicht mindestens ein Tipp gegeben wurde.");
            if(this.revolte.needed == -1) {
                this.revolte.needed = Math.round((channel.getUserCount()-1)/3*2);
            }
            if(this.revolte.has.indexOf(user.getNick()) == -1) {
                this.revolte.has.push(user.getNick());
                if(this.revolte.has.length == this.revolte.needed) {
                    client.say(channel.getName(), "[\u0002QUIZ\u000f] Diese Frage wird übersprungen.");
                    this.stopTipps();
                    this.wait = true;
                    var ___that = this;
                    setTimeout(function() {
                        ___that.showQuestion(client);
                    }, this.questionDelay*1000);
                }
                else {
                    client.say(channel.getName(), "[\u0002QUIZ\u000f] " + user.getNick() + " und " + (this.revolte.has.length-1) + " andere mögen diese Frage nicht. Ihr braucht min. " + this.revolte.needed + " Stimmen.");
                }
            }
        }
    },
    onLoad: function() {
        for(var i=0; i<this.questions.length; i++) {
            this.questions[ i ].alreadyAsked = false;
            this.questions[ i ].answered = false;
        }
    },
    onUnload: function() {}
};