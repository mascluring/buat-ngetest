const http = require('http');
http.get('http://localhost:3000/manager/1', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const errorMatch = data.match(/Error:/g);
    console.log('Found errors:', errorMatch ? errorMatch.length : 0);
  });
});
