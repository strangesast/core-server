var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var expressJwt = require('express-jwt');
var config = require('config');

var secret = config.get('secret');

function createToken(id, username) {
  const payload = {
    id,
    username,
    admin: true,
    'https://hasura.io/jwt/claims': {
      'x-hasura-allowed-roles': ['admin'],
      'x-hasura-default-role': 'admin',
      'x-hasura-user-id': '' + id,
    },
  };
  const token = jwt.sign(payload, secret, {expiresIn: '365 days'});
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
  res.json({ token, user: { id, username }});
});

router.post('/login', async (req, res) => {
  const { email, username, password } = req.body;
  if ((!username && !email) || !password) {
    res.status(400).json({status: 400, message: 'Missing required parameters'});
    return;
  }
  console.log(username, email, password);
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
      const {id, username} = result.rows[0];
      const token = createToken(id, username);
      res.json({token, user: {id, username}});
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
