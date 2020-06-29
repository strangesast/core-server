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
			select *
      from machine_execution_state
			where value = 'ACTIVE'
			order by timestamp desc
		) t
	) t
	where r < 21
) b on (a.machine_id = b.machine_id and a.timestamp >= b.timestamp and a.timestamp < b.next_timestamp)
`));

router.get('/weekly', async (req, res, next) => {
  const client = await req.app.locals.db.connect();
  let {fromDate, toDate, bucketSize} = req.query;
  ([fromDate, toDate] = [fromDate, toDate].map(s => s && new Date(s))); 
  if ([fromDate, toDate].some(d => isNaN(d))) {
    const err = new Error('invalid query params');
    err.status = 400;
    next(err);
    return;
  }
  bucketSize = bucketSize && parseInt(bucketSize, 10);
  if (isNaN(bucketSize)) {
    bucketSize = 30;
  }

  try {
    const result = await client.query(`
      select bucket::integer, dt as "date", array_agg(id) as shifts, array_agg(employee_id) as employees
      from (
      	select dt, rank() over (order by dt) as bucket
      	from generate_series($1, $2, interval '1 minutes' * $3) as "dt"
      ) a
      inner join (
        select *
        from (
          select
            id,
            employee_id,
            date_start,
            date_stop,
            (case when date_stop is null then now() else date_stop end) - date_start as duration
          from timeclock_shifts
        ) b
        where duration < interval '14 hours'
      ) b on (b.date_start < a.dt and (b.date_stop is null or b.date_stop > a.dt))
      group by bucket, dt
      order by dt asc`, [fromDate, toDate, bucketSize]);
    res.json(result.rows);
  } catch (e) {
    next(e);
  } finally {
    client.release();
  }
});

router.get('/part-activity', func(`
  select
  	a.value as part_count,
  	a.machine_id,
  	a.timestamp as part_count_timestamp,
  	a.prev_timestamp as part_count_prev_timestamp,
  	b.timestamp,
  	b.next_timestamp
  from (
  	select
  		value,
  		machine_id,
  		"offset",
  		timestamp,
  		lag(timestamp, 1) over (partition by machine_id order by timestamp asc) as prev_timestamp
  	from (
  		select
  			value,
  			machine_id,
  			"offset",
  			dense_rank() over (partition by machine_id, value order by timestamp asc) as r,
  			to_timestamp(timestamp / 1000) as timestamp
  		from machine_state
  		where property = 'part_count' and value != 'UNAVAILABLE'
  	) a
  	where r = 1
  ) a
  join (
  	select * from machine_execution_state
  	where value = 'ACTIVE'
  ) b on (a.machine_id = b.machine_id and b.timestamp > a.prev_timestamp and b.timestamp < a.timestamp)
  order by a.timestamp desc
`));

module.exports = router;
