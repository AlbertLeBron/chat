const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
//使用静态资源访问,public为根目录
app.use(express.static(path.join(__dirname, '')))
 
app.listen(8869, () => {
  console.log(`App listening at port 8869`)
});