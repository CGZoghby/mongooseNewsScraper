//We're scraping cracked!
var express = require("express");
// Set Handlebars.
var exphbs = require("express-handlebars");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
// Initialize Express
var app = express();
// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");
// Require all models
var db = require("./models");

//Set up handlebars for rendering article content
app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

var PORT = process.env.PORT || 3000;

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: true }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
//connect to MONGODB_URI
mongoose.connect(MONGODB_URI);

// Routes
//preload the articleJSON in the global scope, this allows my ajax requests to populate it, and then the home get to 
//use it.
var articleJSON = {};
app.get("/", function (req, res) {
    //each article has an id, link, and title
    res.render("index", { articles: articleJSON });
})

// A GET route for scraping the echoJS website
app.get("/scrape", function (req, res) {
    // First, we grab the body of the html with request
    axios.get("http://www.cracked.com/funny-articles.html").then(function (response) {
        // Then, we load that into cheerio and save it to $ for a shorthand selector
        var $ = cheerio.load(response.data);

        // Now, we grab every h3 within an article tag, and do the following:
        $(".content-card-content h3").each(function (i, element) {
            // Save an empty result object
            var result = {};

            // Add the text and href of every link, and save them as properties of the result object
            result.title = $(this)
                .children("a")
                .text();
            result.link = $(this)
                .children("a")
                .attr("href");

            // Create a new Article using the `result` object built from scraping
            db.article.create(result)
                .then(function (dbArticle) {
                    // View the added result in the console
                    console.log(dbArticle);
                })
                .catch(function (err) {
                    // If an error occurred, send it to the client
                    return res.json(err);
                });
        });

        // If we were able to successfully scrape and save an Article, send a message to the client
        res.send("Scrape Complete");
    });
});

//function articleGrab() {
// Route for getting all Articles from the db
//var articleJSON = {};
app.get("/articles", function (req, res) {
    db.article.find({})
        .then(function (dbArticle) {
            // If all Notes are successfully found, send them back to the client
            articleJSON = dbArticle;
            res.json(dbArticle);
        })
        .catch(function (err) {
            // If an error occurs, send the error back to the client
            res.json(err);
        });
});
//return articleJSON;
//};

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function (req, res) {
    db.article.findOne({ _id: req.params.id })
        .populate("comment")
        .then(function (dbArticle) {
            // If all Notes are successfully found, send them back to the client
            res.json(dbArticle);
        })
        .catch(function (err) {
            // If an error occurs, send the error back to the client
            res.json(err);
        });
});

// Route for saving/updating an Article's associated comment
app.post("/articles/:id", function (req, res) {
    db.comment.create(req.body)
        .then(function (dbComment) {
            return db.article.findOneAndUpdate({ _id: req.params.id }, { note: dbComment._id }, { new: true });
        })
        .then(function (dbArticle) {
            // If we were able to successfully update an Article, send it back to the client
            res.json(dbArticle);
        })
        .catch(function (err) {
            // If an error occurred, send it to the client
            res.json(err);
        });
});

// Start the server
app.listen(PORT, function () {
    console.log("App running on port " + PORT + "!");
});
