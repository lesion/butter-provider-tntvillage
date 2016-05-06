'use strict';

var GenericProvider = require('butter-provider');
var querystring = require('querystring');
var Q = require('q');
var request = require('request');
var inherits = require('util').inherits;
var _ = require('lodash');
var Datastore = require('nedb');
var tnt_provider = require('./tnt');

var apiUrl = 'http://butter.TNT.net/popcorn';
var db = new Datastore();

function TNT() {
  if (!(this instanceof TNT)) {
    return new TNT();
  }

  GenericProvider.call(this);
}
inherits(TNT, GenericProvider);

TNT.prototype.config = {
  name: 'tnt',
  uniqueId: 'imdb_id',
  tabName: 'TNT',
  type: 'movie',
  /* should be removed */
  //subtitle: 'ysubs',
  metadata: 'trakttv:movie-metadata'
};

function formatForButter(items) {
  console.error('dentro formatforbutter ', items)
  var results = {};
  var movieFetch = {};
  movieFetch.results = [];
  movieFetch.hasMore = (Number(items.length) > 1 ? true : false);
  _.each(items, function(movie) {
    if (movie.Quality === '3D') {
      return;
    }
    var imdb = parseInt(Math.random() * 1000, 10).toString();

    // Calc torrent health
    var seeds = 0; //XXX movie.TorrentSeeds;
    var peers = 0; //XXX movie.TorrentPeers;

    var torrents = {};
    torrents['720p'] = {
      url: movie.torrent,
      size: 1000,
      filesize: "1.02G",
      seed: seeds,
      peer: peers
    };

    var ptItem = results[imdb];
    if (!ptItem) {
      ptItem = {
        imdb_id: imdb,
        title: movie.title.replace(/\([^)]*\)|1080p|DIRECTORS CUT|EXTENDED|UNRATED|3D|[()]/g, ''),
        year: 2010,
        runtime: 90,
        _id: imdb,
        genres: ['war'],
        rating: "10",
        image: 'http://vodo.net/media/posters/poster_personofinterest.jpg',
        cover: 'http://vodo.net/media/posters/poster_personofinterest.jpg',
        backdrop: 'http://vodo.net/media/posters/poster_personofinterest.jpg',
        torrents: torrents,
        subtitle: {}, // TODO
        trailer: false,
        synopsis: movie.Synopsis || 'No synopsis available.',
        type: 'movie'
      };

      movieFetch.results.push(ptItem);
    } else {
      _.extend(ptItem.torrents, torrents);
    }

    results[imdb] = ptItem;
  });
  console.error('alla fine di formatfo')
  console.error(movieFetch.results)
  return movieFetch.results;
}

TNT.prototype.extractIds = function(items) {
  return _.pluck(items.results, 'imdb_id');
};

TNT.prototype.updateAPI = function() {
  console.error('SONO DENRO UPDAT !!!')
  // var self = this;
  // var defer = Q.defer();
  console.info('Request to TNT');
  return tnt_provider
    .update()
    .then(function(data) {
      console.error('DOPO UPDATE !! qui dovrei avere la ciccia !!')
      console.error(data)
        // return data
        // request({
        //     uri: apiUrl,
        //     strictSSL: false,
        //     json: true,
        //     timeout: 10000
        //   },
        //   function(err, res, data) {
        /*
          data = _.map (helpers.formatForButter(data), function (item) {
          item.rating = item.rating.percentage * Math.log(item.rating.votes);
          return item;
          });
        */
       
      db.insert(formatForButter(data), function(err, newDocs) {
        if (err) {
          console.error('TNT.updateAPI(): Error inserting', err);
        }

        db.find({}).limit(2).exec(function(err, docs) {
          console.debug('FIND ---->', err, docs);
        });
        return newDocs;
      });
      return formatForButter(data)
    });

  // return defer.promise;
};

TNT.prototype.fetch = function(filters) {
  console.error('DENTRO FETCHIA !!!');
  var self = this;
  if (!self.fetchPromise) {
    self.fetchPromise = this.updateAPI();
  }

  var defer = Q.defer();
  var params = {
    sort: 'rating',
    limit: 50
  };
  var findOpts = {};

  if (filters.keywords) {
    findOpts = {
      title: new RegExp(filters.keywords.replace(/\s/g, '\\s+'))
    };
  }

  if (filters.genre) {
    params.genre = filters.genre;
  }

  if (filters.order) {
    params.order = filters.order;
  }

  if (filters.sorter && filters.sorter !== 'popularity') {
    params.sort = filters.sorter;
  }

  var sortOpts = {};
  sortOpts[params.sort] = params.order;

  return self.fetchPromise.then(function(data,altricazzi) {
    console.error('demtrp qoifj sodfij soidf ')
    console.error(data)
    console.error(altricazzi)
      // db.find(findOpts)
      //   .sort(sortOpts)
      //   .skip((filters.page - 1) * params.limit)
      //   .limit(Number(params.limit))
      //   .exec(function(err, docs) {
      //     docs.forEach(function(entry) {
      //       entry.type = 'movie';
      //     });

    console.error('dentro DATA: ')
    console.error(data)
    return {
      results: data,
      hasMore: data.length ? true : false
    }
  });

  // return defer.promise;
};

TNT.prototype.random = function() {
  var defer = Q.defer();

  function get(index) {
    var options = {
      uri: apiUrl + Math.round((new Date()).valueOf() / 1000),
      json: true,
      timeout: 10000
    };
    var req = _.extend(true, {}, apiUrl[index], options);
    request(req, function(err, res, data) {
      if (err || res.statusCode >= 400 || (data && !data.data)) {
        console.error('TNT API endpoint \'%s\' failed.', apiUrl);
        if (index + 1 >= apiUrl.length) {
          return defer.reject(err || 'Status Code is above 400');
        } else {
          get(index + 1);
        }
        return;
      } else if (!data || data.status === 'error') {
        err = data ? data.status_message : 'No data returned';
        return defer.reject(err);
      } else {
        return defer.resolve(Common.sanitize(data.data));
      }
    });
  }
  get(0);

  return defer.promise;
};

TNT.prototype.detail = function(torrent_id, old_data) {
  return Q(old_data);
};


module.exports = TNT