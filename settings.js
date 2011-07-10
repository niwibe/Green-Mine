var cradle = require('cradle');

module.exports = {
    dbname: 'test2',
    dburl: 'http://localhost',
    dbport: 5984,
    dbsettings: {cache: true, raw: false},
    get_database: function() {
        var connection = new(cradle.Connection)(this.dburl, this.dbport);
        var database = connection.database(this.dbname);
        database.exists(function(err, value){
            if(!value && !err) { database.create(); }
        });
        return database;
    },
}
