const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = new Database('workflow.db');
// create table if not exists
// nodes table: id, type, data(text), positionX, positionY
// edges: id, source, target

const init = () => {
  db.prepare(`CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    type TEXT,
    data TEXT,
    posX REAL,
    posY REAL
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source TEXT,
    target TEXT
  )`).run();
};
init();

app.get('/nodes', (req, res) => {
  const nodes = db.prepare('SELECT * FROM nodes').all();
  const edges = db.prepare('SELECT * FROM edges').all();
  res.json({nodes, edges});
});

app.post('/nodes', (req, res) => {
  const {id, type, data, posX, posY} = req.body;
  db.prepare('INSERT OR REPLACE INTO nodes(id,type,data,posX,posY) VALUES (?,?,?,?,?)')
    .run(id, type, JSON.stringify(data), posX, posY);
  res.json({status: 'ok'});
});

app.post('/edges', (req, res) => {
  const {id, source, target} = req.body;
  db.prepare('INSERT OR REPLACE INTO edges(id,source,target) VALUES (?,?,?)')
    .run(id, source, target);
  res.json({status: 'ok'});
});

app.listen(3001, () => console.log('Backend running on 3001')); 
