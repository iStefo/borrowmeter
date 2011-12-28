(function() {
  var BSON, Connection, Db, Server, app, db, express, fs, host, port, test;

  fs = require('fs');

  express = require('express');

  app = express.createServer({
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
  });

  test = require('assert');

  Db = require('mongodb').Db;

  Connection = require('mongodb').Connection;

  Server = require('mongodb').Server;

  BSON = require('mongodb').BSONPure;

  host = 'localhost';

  port = Connection.DEFAULT_PORT;

  console.log("Connecting to " + host + ":" + port);

  db = new Db('borrowmeter', new Server("127.0.0.1", 27017, {}));

  app.use(express.bodyParser());

  app.set('view engine', 'jade');

  app.use(express.cookieParser());

  app.use(express.session({
    secret: "borrowmeter",
    cookie: {
      maxAge: 3600000,
      secure: true
    }
  }));

  app.use(express.static(__dirname + '/public'));

  app.get('/', function(req, res) {
    if (!req.session.login) {
      res.redirect('/login/');
      return 0;
    }
    return db.open(function(err, db) {
      return db.collection('payment', function(err, collection) {
        var antibalance, balance;
        balance = 0;
        antibalance = 0;
        return collection.find({}, {
          'sort': {
            $natural: -1
          }
        }, function(err, cursor) {
          return cursor.toArray(function(err, items) {
            var item, _i, _len;
            for (_i = 0, _len = items.length; _i < _len; _i++) {
              item = items[_i];
              if (item.by === req.session.user.name) {
                balance += parseInt(item.value);
              } else {
                antibalance += parseInt(item.value);
              }
            }
            balance -= antibalance;
            return res.render('index', {
              balance: balance,
              name: req.session.user.name,
              payments: items
            });
          });
        });
        /*		
        			collection.find { "by": { $ne: req.session.user.name }}, {}, (err, cursor) ->
        				cursor.toArray (err, items) ->
        					for item in items
        						antibalance += parseInt(item.value)
        					collection.find { "by": req.session.user.name }, {} ,(err, cursor) ->
        						balance = 0
        						cursor.toArray (err, items) ->
        							for item in items
        								balance += parseInt(item.value)
        							balance -= antibalance
        							res.render 'index', { balance: balance, name: req.session.user.name, payments: items }
        */
      });
    });
  });

  app.post('/login/', function(req, res) {
    req.session.login = false;
    if (!req.session.user) req.session.user = {};
    return db.open(function(err, db) {
      return db.collection('user', function(err, collection) {
        return collection.find(function(err, cursor) {
          return cursor.each(function(err, item) {
            if ((item != null ? item.name : void 0) === req.body.user.name && (item != null ? item.pass : void 0) === req.body.user.pass) {
              req.session.login = true;
              req.session.user.name = req.body.user.name;
              console.log("Successful login by " + req.session.user.name);
              return false;
            }
            if (!item) return res.redirect('/');
          });
        });
      });
    });
  });

  app.get('/login*', function(req, res) {
    return res.render('loginform');
  });

  app.post('/pay/', function(req, res) {
    if (!req.session.login) {
      res.redirect('/login/');
      return 0;
    }
    if (req.body.payment.subject.length < 1 || req.body.payment.value.length < 1) {
      res.redirect('/');
      return 0;
    }
    return db.open(function(err, db) {
      return db.collection('payment', function(err, collection) {
        collection.insert({
          subject: req.body.payment.subject,
          value: req.body.payment.value,
          by: req.session.user.name
        });
        return res.redirect('/');
      });
    });
  });

  app.get('/pay*', function(req, res) {
    if (!req.session.login) {
      res.redirect('/login/');
      return 0;
    }
    return res.render('pay');
  });

  app.post('/delete', function(req, res) {
    if (!req.session.login) {
      res.redirect('/login/');
      return 0;
    }
    console.log("Delete " + req.body.id);
    return db.open(function(err, db) {
      return db.collection('payment', function(err, collection) {
        return collection.remove({
          _id: BSON.ObjectID.createFromHexString(req.body.id)
        }, function(err, result) {
          console.log(err, result);
          return res.send(JSON.stringify(err));
        });
      });
    });
  });

  app.listen(1337);

}).call(this);
