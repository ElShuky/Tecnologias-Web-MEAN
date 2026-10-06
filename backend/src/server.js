const express = require('express');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}

module.exports = app;
