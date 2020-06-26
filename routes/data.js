var express = require('express');
var router = express.Router();

router.get('/', async (req, res, next) => {
  const client = await req.app.locals.db.connect();
  try {
    const result = await client.query(`
      select count(*) from machine_state
      union all
      select count(*) from machine_values
    `);
    res.json(result.rows);
  } catch (e) {
    next(e);
  } finally {
    client.release();
  }
});


function func(query) {
  return async (req, res, next) => {
    const client = await req.app.locals.db.connect();
    try {
      const result = await client.query(query);
      res.json(result.rows);
    } catch (e) {
      next(e);
    } finally {
      client.release();
    }
  };
}

router.get('/recent-activity', func(`
  select * from (
  	select *, dense_rank() over (partition by machine_id order by timestamp desc) as r
  	from (
  		select * from machine_execution_state
  		where value = 'ACTIVE'
  		order by timestamp desc
  	) t
  ) t
  where r < 10
`));

router.get('/recent-data', func(`
select a.*, b.r from (
	select
		machine_id,
		property,
		value,
		to_timestamp(timestamp/1000) as timestamp,
		"offset"
	from machine_values
	where value != 'UNAVAILABLE'
) as a
join (
	select
		machine_id,
		value,
		timestamp,
		case when next_timestamp is null then now() else next_timestamp end,
		"offset",
		r
	from (
		select *, dense_rank() over (partition by machine_id order by timestamp desc) as r
		from (
			select * from machine_execution_state
			where value = 'ACTIVE'
			order by timestamp desc
		) t
	) t
	where r < 21
) b on (a.machine_id = b.machine_id and a.timestamp >= b.timestamp and a.timestamp < b.next_timestamp)
`));

module.exports = router;
