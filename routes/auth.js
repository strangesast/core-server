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

router.get('/check', async (req, res, next) => {
  const query = req.query;

  const keys = ['username', 'email']
    .map(k => ([k, query[k]]))
    .filter(([k, v]) => v);

  const [s, args] = keys
    .map(([k, v], i) => ([`(SELECT '${k}' as key FROM users where ${k} = $${i + 1} LIMIT 1)`, v]))
    .reduce(([a, b], [aa, bb]) => ([a.concat(aa), b.concat(bb)]), [[], []]);

  if (s.length == 0) {
    res.json({});
    return;
  }
  const q = s.join('UNION ALL');

  let result;
  const client = await req.app.locals.db.connect();
  try {
    result = await client.query(q, args);
    result = result.rows.map(row => row['key']);
    result = keys.reduce((obj, [k]) => ({...obj, [k]: result.includes(k)}), {});
    res.json(result);
  } catch (e) {
    next(e);
    return;
  } finally {
    client.release();
  }
});

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
  if (req.user != null) {
    next();
    return;
  }
  const { username, password, name, email } = req.body;
  const { middle: middleName, first: firstName, last: lastName } = name;
  const args = [username, email, password, firstName, lastName, middleName];
  if (args.slice(0, 3).some(v => !v)) {
    res.status(400).json({status: 400, message: `Missing required user properties`}); 
    return;
  }

  let id;
  const client = await req.app.locals.db.connect();
  try {
    const result = await client.query(
      'insert into users(username, email, password, first_name, last_name, middle_name) values($1, $2, crypt($3, gen_salt(\'bf\')), $4, $5, $6) returning id',
      args,
    );
    ({ id } = result.rows[0]);
  } catch (error) {
    const constraint = error.constraint;
    const message = error.detail || 'failed to insert';
    res.status(400).json({status: 400, message, error});
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
    res.status(400).json({status: 400, message: 'Missing required parameters'});
    return;
  }
  const client = await req.app.locals.db.connect();
  let q, args;
  if (email) {
    q = 'select * from users where email = lower($1) and password = crypt($2, password)';
    args = [email, password];
  } else {
    q = 'select * from users where username = $1 and password = crypt($2, password)';
    args = [username, password];
  }
  try {
    const result = await client.query(q, args);
    if (result.rows.length > 0) {
      let user = result.rows[0];
      const id = user.id;
      const {first_name, last_name, middle_name, username, email} = user;
      user = {name: {first: first_name, middle: middle_name, last: last_name}, username, email, roles: ['toast']};
      const token = createToken(id, username);
      res.json({token, user});
    } else {
      res.sendStatus(401);
    }
  } catch (error) {
    res.status(400).json({status: 400, message: error.detail, error});
  } finally {
    client.release();
  }
});


module.exports = router;
