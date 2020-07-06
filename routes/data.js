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

const weeklyQuery = `
  select *
  from (
    select
    	count(*)::integer as "bucket",
    	bucket as "date",
    	array_agg(employee_id) as employees,
    	array_agg(id) as shifts
    from (
    	select
    		id,
    		employee_id,
    		to_timestamp(round(bucket / $3) * $3) at time zone 'America/New_York' as bucket
    	from (
    		select
    			id,
    			employee_id,
    			generate_series(
    				extract(epoch from date_start)::integer,
    				extract(epoch from date_start + duration)::integer,
    				$3
    			) as bucket
    		from (
    			select *
    			from (
    				select
    					id,
    					date_start,
    					date_stop,
    					employee_id,
    					(case when date_stop is null then now() else date_stop end) - date_start as duration
    				from timeclock_shifts
    			) t
    			where (
    				duration < interval '13 hours' and
    				(date_stop is null or date_stop > $1) and
    				date_start < $2
    			)
    		) t
    	) t
    ) t
    group by bucket
  ) t
  where (date <= $2 and date > $1)
  order by date asc
`;

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
    const result = await client.query(weeklyQuery, [fromDate, toDate, bucketSize * 60]);
    res.json(result.rows);
  } catch (e) {
    next(e);
  } finally {
    client.release();
  }
});

router.get('/shifts', async (req, res, next) => {
  let {minDate, maxDate} = req.query;
  ([minDate, maxDate] = [minDate, maxDate].map(s => s && new Date(s)));
  if (maxDate == null) {
    maxDate = new Date();
  }
  if (minDate == null) {
    minDate = new Date(maxDate);
    minDate.setDate(minDate.getDate() - 1);
  }
  const query = `
	select
	  a.id,
	  a.employee_id,
	  a.shift_num::integer,
	  a.date,
	  a.date_start,
	  a.date_stop,
	  b.segments
	from timeclock_shifts_count a
	join (
	  select
	    employee_id,
	    shift_num,
		array_to_json(array_agg((extract(epoch from date_start), extract(epoch from date_stop)))) as segments
	  from timeclock_shifts_count
	  group by employee_id, shift_num
	) b on (a.employee_id = b.employee_id and a.shift_num = b.shift_num)
	where (
	  ((date_stop is null or date_stop > $1) and date_start < $2) or
	  (date_start < $1 and date_stop > $2)
	)
  `;
  const client = await req.app.locals.db.connect();
  try {
    const result = await client.query(query, [minDate, maxDate]);
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
