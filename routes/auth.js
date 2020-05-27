var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var expressJwt = require('express-jwt');
var config = require('config');

var secret = config.get('secret');

function createToken(id, username) {
  const token = jwt.sign({id, username}, secret, {expiresIn: '365 days'});
  return token;
}

router.get('/user', expressJwt({secret}), async (req, res) => {
  let user = req.user || null;
  if (user != null) {
    const {id, username} = user;
    const q = 'select id, first_name, last_name, username, email from users where id = $1 OR username = $2';
    const args = [id, username];
    const client = await req.app.locals.db.connect();

    let result;
    try {
      result = await client.query(q, args);
    } catch (e) {
      next(e);
      return;
    } finally {
      client.release();
    }

    if (result.rows.length == 0) {
      res.status(500).json({status: 500, message: `user not found with id (${id}) or username (${username})`});
      return;
    }
    user = result.rows[0];
  }
  res.json({ user });
});

router.delete('/user', async (req, res) => {
  const { username, id } = req.body;
  if (!id && !username) {
    res.status(400).json({status: 400, message: 'missing required parameter'});
    return;
  }
  const client = await req.app.locals.db.connect();
  try {
    const result = await client.query(`delete from users where ${id != null ? 'id' : 'username'}=$1`, [id != null ? id : username])
    res.sendStatus(201);
  } catch (e) {
    res.sendStatus(400);
  } finally {
    client.release();
  }

});

router.post('/user', async (req, res, next) => {
  console.log('user', req.user);
  if (req.user != null) {
    next();
    return;
  }
  const { username, password, name, email } = req.body;
  const { first: firstName, last: lastName } = name;
  const args = [username, email, password, firstName, lastName];
  console.log(args);
  if (args.slice(0, 3).some(v => !v)) {
    res.status(400).json({status: 400, message: `Missing required user properties`}); 
    return;
  }

  let id;
  const client = await req.app.locals.db.connect();
  try {
    const result = await client.query(
      'insert into users(username, email, password, first_name, last_name) values($1, $2, crypt($3, gen_salt(\'bf\')), $4, $5) returning id',
      args,
    );
    ({ id } = result.rows[0]);
  } catch (e) {
    const constraint = e.constraint;
    res.status(400).json({status: 400, message: e.detail});
    return;
  } finally {
    client.release();
  }
  const token = createToken(id, username);
  res.json({ token, id });
});

router.post('/login', async (req, res) => {
  const { email, username, password } = req.body;
  if ((!username && !email) || !password) {
    res.sendStatus(400);
    return;
  }
  const client = await req.app.locals.db.connect();
  let q, args;
  if (email) {
    q = 'select username from users where email = lower($1) and password = crypt($2, password)';
    args = [email, password];
  } else {
    q = 'select username from users where username = $1 and password = crypt($2, password)';
    args = [username, password];
  }
  try {
    const result = await client.query(q, args);
    if (result.rows.length > 0) {
      const {username} = result.rows[0];
      const token = createToken(id, username);
      res.json({token});
    } else {
      res.sendStatus(401);
    }
  } catch (e) {
    res.sendStatus(400);
  } finally {
    client.release();
  }
});


module.exports = router;
