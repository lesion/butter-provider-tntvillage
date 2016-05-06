'use strict'
/**
 * TNTVillage metadata explorer !
 */

const fetch = require('node-fetch')
const parser = require('configurable-html-parser')

module.exports = (function() {
  let self = {}


  /**
   * format bytes to human readable size
   * source: https://jsfiddle.net/oy02axhh/
   * @param  {int} bytes   
   * @param  {int} decimals 
   * @return {string} size
   */
  function toSize(bytes, decimals) {
    if (bytes === 0) return '0 Byte';
    var k = 1000; // or 1024 for binary
    var dm = decimals + 1 || 3;
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * get detail of specified link
   * @param  {url} link
   * @return {Object} 
   */
  self.get_detail = function(link) {
    fetch(link)
      .then(function(res) {
        return res.text()
      })
      .then(function(body) {
        parser(body, {
          img: {
            selector: '.postcolor',
            regexp: /<img\s+src="([\s\S]*?)">/
          }
        })
      })
      // .then(res => res)
      .then(console.log)
  }

  // download metadata from rss
  self.update = function() {
    return fetch('http://www.tntvillage.scambioetico.org/rss.php?c=4&p=10')
      .then(function(res) {
        console.error('dopo il fetch, ma porcoddio ')
        console.error(typeof res)
        console.error(res)
        return res.text();
      })
      .then(function(data) {
        console.error(data)
        console.error('son qui prima di xml2json')
        return new Promise(function(reject,resolve){
          var parser = new require('xml2js').Parser()
          return parser.parseString(data,function(err,res){
            if(!err)
              return resolve(res)
            return reject(err)
          })
        })
      })
      .then(function(data) {
        data.rss.channel.item.map(function(f) {
          console.error('cosa ne dici di questo ! ');
          console.error(f)
          return {
            title: f.title,
            link: f.link,
            torrent: f.enclosure.url,
            length: toSize(f.enclosure.length, 1)
          }
        })
      })
      .catch(function(e){console.error('eggia!',e);})
  }

  // self.update()
  // self.get_detail('http://forum.tntvillage.scambioetico.org/index.php?showtopic=503898')

  return self
}())
