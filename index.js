var isolines = require('turf-isolines'),
    grid = require('turf-grid'),
    destination = require('turf-destination'),
    point = require('turf-point'),
    extent = require('turf-extent'),
    featureCollection = require('turf-featurecollection'),
    polylineDecode = require('polyline').decode,
    OSRM = require('osrm');

module.exports = function (center, times, resolution, maxspeed, network, done) {
    var osrm = new OSRM(network);
    times = Array.isArray(times) ? times : [times];
    var time = times[times.length - 1];
    // compute bbox
    // bbox should go out 1.4 miles in each direction for each minute
    // this will account for a driver going a bit above the max safe speed
    var centerPt = point(center[0], center[1]);
    var spokes = featureCollection([]);
    var km = (time/3600) * maxspeed;
    spokes.features.push(destination(centerPt, km, 180, 'kilometers'));
    spokes.features.push(destination(centerPt, km, 0, 'kilometers'));
    spokes.features.push(destination(centerPt, km, 90, 'kilometers'));
    spokes.features.push(destination(centerPt, km, -90, 'kilometers'));
    var bbox = extent(spokes);

    //compute destination grid
    var targets = grid(bbox, resolution);
    var destinations = featureCollection([]);
    var i = 0;
    var routedNum = 0;

    getNext(i);

    function getNext(i){
        if(destinations.length >= targets.length){
            return;
        }
        if(i < targets.features.length) {
            var query = {
                coordinates: [
                    [
                      center[1], center[0]
                    ],
                    [
                      targets.features[i].geometry.coordinates[1], targets.features[i].geometry.coordinates[0]
                    ]
                ],
                alternateRoute: false,
                printInstructions: false
            };
        
            osrm.route(query, function(err, res){
                i++;
                if(err) console.log(err);
                if(err) return done(err);
                else if (!res || !res.route_summary) {
                    destinations.features.push({
                        type: 'Feature',
                        properties: {
                            eta: time+100
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [query.coordinates[1][1], query.coordinates[1][0]]
                        }
                    });
                } else {
                    destinations.features.push({
                        type: 'Feature',
                        properties: {
                            eta: res.route_summary.total_time,
                            dist: res.route_summary.total_distance
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [res.via_points[1][1], res.via_points[1][0]]
                        }
                        });
                }
                getNext(i);
            });
        } else {
            var line = isolines(destinations, 'eta', resolution, times);
            return done(null, line);
        }
    }
};
