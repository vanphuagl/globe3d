var w,
    h,
    scl,
    is3d = true;
var svg = d3.select("#svgGlobe").append("svg");
var projection = d3.geoOrthographic();

var path = d3.geoPath().projection(projection);
var map = svg.append("g");

var drag = d3.drag().on("start", dragstarted).on("drag", dragged);

var gpos0, o0, gpos1, o1;
svg.call(drag);

var zoom = d3
    .zoom()

    .on("zoom", zoomed);

svg.call(zoom);

d3.json(
    "https://gist.githubusercontent.com/sarah37/dcca42b936545d9ee9f0bc8052e03dbd/raw/550cfee8177df10e515d82f7eb80bce4f72c52de/world-110m.json"
).then(function (json) {
    map
        .append("path")
        .datum({ type: "Sphere" })
        .attr("class", "ocean")
        .attr("d", path);

    map
        .append("path")
        .datum(topojson.merge(json, json.objects.countries.geometries))
        .attr("class", "land")
        .attr("d", path);

    map
        .append("path")
        .datum(
            topojson.mesh(json, json.objects.countries, function (a, b) {
                return a !== b;
            })
        )
        .attr("class", "boundary")
        .attr("d", path);
});


let resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    scl = Math.min(w, h) / 2.5;
    projection.translate([w / 2, h / 2]);
    svg.attr("width", w).attr("height", h);
    map.selectAll("path").attr("d", path);
};

resize();

d3.select(window).on("resize", resize);

function switchProjection() {
    let s = projection.scale();
    let r = projection.rotate();
    let c = projection.center();
    if ((is3d = !is3d)) {
        projection = d3.geoOrthographic();
        projection.rotate([-c[0], -c[1]]);
    } else {
        projection = d3.geoMercator();
        projection.center([-r[0], -r[1]]);
    }
    projection.scale(s);
    map.selectAll("path").attr("d", path.projection(projection));
    resize();
}

function dragstarted() {
    gpos0 = projection.invert(d3.mouse(this));
    c0 = projection.center();
}

function dragged() {
    gpos1 = projection.invert(d3.mouse(this));
    if (is3d) {
        o0 = projection.rotate();
        o1 = eulerAngles(gpos0, gpos1, o0);
        o1 && projection.rotate(o1);
    } else {
    }

    map.selectAll("path").attr("d", path);
}

function zoomed() {
    projection.scale(d3.event.transform.translate(projection).k * scl);
    map.selectAll("path").attr("d", path);
}

var to_radians = Math.PI / 180;
var to_degrees = 180 / Math.PI;

function cross(v0, v1) {
    return [
        v0[1] * v1[2] - v0[2] * v1[1],
        v0[2] * v1[0] - v0[0] * v1[2],
        v0[0] * v1[1] - v0[1] * v1[0],
    ];
}

function dot(v0, v1) {
    for (var i = 0, sum = 0; v0.length > i; ++i) sum += v0[i] * v1[i];
    return sum;
}

function lonlat2xyz(coord) {
    var lon = coord[0] * to_radians;
    var lat = coord[1] * to_radians;

    var x = Math.cos(lat) * Math.cos(lon);

    var y = Math.cos(lat) * Math.sin(lon);

    var z = Math.sin(lat);

    return [x, y, z];
}

function quaternion(v0, v1) {
    if (v0 && v1) {
        var w = cross(v0, v1), // vector pendicular to v0 & v1
            w_len = Math.sqrt(dot(w, w)); // length of w

        if (w_len == 0) return;

        var theta = 0.5 * Math.acos(Math.max(-1, Math.min(1, dot(v0, v1)))),
            qi = (w[2] * Math.sin(theta)) / w_len;
        qj = (-w[1] * Math.sin(theta)) / w_len;
        qk = (w[0] * Math.sin(theta)) / w_len;
        qr = Math.cos(theta);

        return theta && [qr, qi, qj, qk];
    }
}

function euler2quat(e) {
    if (!e) return;

    var roll = 0.5 * e[0] * to_radians,
        pitch = 0.5 * e[1] * to_radians,
        yaw = 0.5 * e[2] * to_radians,
        sr = Math.sin(roll),
        cr = Math.cos(roll),
        sp = Math.sin(pitch),
        cp = Math.cos(pitch),
        sy = Math.sin(yaw),
        cy = Math.cos(yaw),
        qi = sr * cp * cy - cr * sp * sy,
        qj = cr * sp * cy + sr * cp * sy,
        qk = cr * cp * sy - sr * sp * cy,
        qr = cr * cp * cy + sr * sp * sy;

    return [qr, qi, qj, qk];
}

function quatMultiply(q1, q2) {
    if (!q1 || !q2) return;

    var a = q1[0],
        b = q1[1],
        c = q1[2],
        d = q1[3],
        e = q2[0],
        f = q2[1],
        g = q2[2],
        h = q2[3];

    return [
        a * e - b * f - c * g - d * h,
        b * e + a * f + c * h - d * g,
        a * g - b * h + c * e + d * f,
        a * h + b * g - c * f + d * e,
    ];
}

function quat2euler(t) {
    if (!t) return;

    return [
        Math.atan2(
            2 * (t[0] * t[1] + t[2] * t[3]),
            1 - 2 * (t[1] * t[1] + t[2] * t[2])
        ) * to_degrees,
        Math.asin(Math.max(-1, Math.min(1, 2 * (t[0] * t[2] - t[3] * t[1])))) *
        to_degrees,
        Math.atan2(
            2 * (t[0] * t[3] + t[1] * t[2]),
            1 - 2 * (t[2] * t[2] + t[3] * t[3])
        ) * to_degrees,
    ];
}

function eulerAngles(v0, v1, o0) {
    var t = quatMultiply(
        euler2quat(o0),
        quaternion(lonlat2xyz(v0), lonlat2xyz(v1))
    );
    return quat2euler(t);
}