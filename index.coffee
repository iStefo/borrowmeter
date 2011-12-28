fs = require 'fs'
express = require 'express'
app = express.createServer({key: fs.readFileSync('server.key'), cert: fs.readFileSync('server.crt')})
test = require 'assert'
Db = require('mongodb').Db
Connection = require('mongodb').Connection
Server = require('mongodb').Server

host = 'localhost'
port = Connection.DEFAULT_PORT
console.log("Connecting to " + host + ":" + port)
db = new Db 'borrowmeter', new Server("127.0.0.1", 27017, {})

app.use express.bodyParser()
app.set 'view engine', 'jade'
app.use express.cookieParser()
app.use express.session({
	secret: "borrowmeter",
	cookie: {
		maxAge: 3600000,
		secure: yes
    }})
app.use express.static(__dirname + '/public')

app.get '/', (req, res) ->
	if not req.session.login
		res.redirect '/login/'
		return 0
	db.open (err, db) ->
		db.collection 'payment', (err, collection) ->
			balance = 0
			antibalance = 0
			collection.find {}, {'sort': {$natural:-1}}, (err, cursor) ->
				cursor.toArray (err, items) ->
					for item in items
						if item.by == req.session.user.name
							balance += parseInt(item.value)
						else
							antibalance += parseInt(item.value)
					balance -= antibalance
					res.render 'index', { balance: balance, name: req.session.user.name, payments: items }
			###		
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
			###

app.post '/login/', (req, res) ->
	req.session.login = no
	req.session.user = {} unless req.session.user
	db.open (err, db) ->
		db.collection 'user', (err, collection) ->
			collection.find (err, cursor) ->
				cursor.each (err, item) ->
					if item?.name == req.body.user.name and item?.pass == req.body.user.pass
						req.session.login = yes
						req.session.user.name = req.body.user.name
						console.log "Successful login by #{req.session.user.name}"
						return false
					if not item
						# end of loop, go back to main page
						res.redirect '/'

app.get '/login*', (req, res) ->
	res.render 'loginform'

app.post '/pay/', (req, res) ->
	if not req.session.login
		res.redirect '/login/'
		return 0
	#validate input
	if req.body.payment.subject.length < 1 or req.body.payment.value.length < 1
		res.redirect '/'
		return 0
	db.open (err, db) ->
		db.collection 'payment', (err, collection) ->
			collection.insert { subject: req.body.payment.subject, value: req.body.payment.value, by: req.session.user.name }
			res.redirect '/'


app.get '/pay*', (req, res) ->
	if not req.session.login
		res.redirect '/login/'
		return 0
	res.render 'pay'

app.listen 1337