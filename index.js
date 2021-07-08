const fs = require('fs')
const process = require('process')
const express = require('express')
const http = require('http')
const https = require('https')

// Returns the inputted filename as if it was located in the script's directory
const lc = (fn) => { return __dirname + "/" + fn }

// Load in the landing page
const page = fs.readFileSync(lc("html/index.html"), 'utf8')

// This parts gets the filename you want to share
const filename = (() => {
    const fn = process.argv.splice(2)[0]
    if (fn == undefined) {
        return
    } else {
        if (fs.existsSync(fn)) {
            return fn
        } else {
            console.log("\x1b[1;91mSpecified file doesn't exist, ignoring\x1b[22;39m")
            return
        }
    }
})()


// Used later to track how many uploads there were
let uploadAmount = 0

// Handles SIGINT aka Ctrl + C
process.on("SIGINT", () => {
    if (filename == undefined) {
        if (uploadAmount == 0) {
            console.log("\x1b[G\x1b[93mReceived no files and exiting!\x1b[39m")
        } else {
            console.log("\x1b[G\x1b[92mReceived\x1b[39m \x1b[1;96m" + uploadAmount.toString(10) + "\x1b[22;39m \x1b[92mfiles and exiting!\x1b[39m")
        }
        process.exit(0)
    }
})

// This parts attempt to get SSL keys for HTTPS
let sslcredentials = null
let foundSSL = true
let port = 8443

try {
    let sslcert = fs.readFileSync(lc("selfsigned.crt"))
    let sslkey = fs.readFileSync(lc("selfsigned.key"))
    sslcredentials = {cert: sslcert, key: sslkey}
} catch (e) {
    foundSSL = false
    port = 8080
}

if (foundSSL) {
    console.log("\x1b[1;95mHTTPS has been enabled, browser will probably warn you that the certificate is self-signed, but you can safely ignore that\x1b[22;39m")
}

const app = express()

// Switches between downloading and uploading
if (filename == undefined) {

    // Load the success and failure HTML, since we only need them when uploading
    const successHTML = fs.readFileSync(lc("html/success.html"), 'utf8')
    const failureHTML = fs.readFileSync(lc("html/failure.html"), 'utf8')

    // We're only importing multer here, since we don't need it when downloading
    const multer = require('multer')
    const storage = multer({ storage : multer.diskStorage({
        destination: (req, file, cb) => { cb(null, '.') },

        // This is as readable as my future
        filename: (req, file, cb) => {
            fs.exists(file.originalname, (exists) => {
                if (exists) {
                    (function recursiveExist(l = 0) {
                        const n = file.originalname + "." + l.toString(10)
                        fs.exists(n, function (exists) {
                            if (exists) { recursiveExist(l + 1) }
                            else { cb( null, n ) }
                        })
                    })()
                } else {
                    cb( null, file.originalname )
                }
            })
        }
    })})

    app.get('/', function(req, res, next) {
        res.send(page)
    })
    app.post('/', storage.single('file'), function(req, res, next) {
        if (req.file == undefined) {
            res.status(400).send(failureHTML)
        } else {
            if (req.file.originalname == req.file.filename) {
                console.log("\x1b[92mReceived file\x1b[39m \x1b[96m'\x1b[1m" + req.file.originalname + "\x1b[22m'\x1b[39m")
            } else {
                console.log("\x1b[92mReceived file\x1b[39m \x1b[96m'\x1b[1m" + req.file.originalname + "\x1b[22m'\x1b[39m\x1b[92m, saved as\x1b[39m \x1b[96m'\x1b[1m" + req.file.filename + "\x1b[22m'\x1b[39m")
            }
            uploadAmount += 1
            res.status(200).send(successHTML)
        }
    })

    console.log("\x1b[93mAwaiting upload(s)\x1b[39m")
} else {
    app.get('/', function(req, res, next) {
        res.download(filename, (err) => {
            if (err == undefined) {
                console.log("\x1b[92mSuccessfully shared file, exiting!\x1b[39m")
                process.exit(0)
            } else {
                console.log("\x1b[91mAn error has occured: '" + err + "'\x1b[39m, continuing")
            }
        })
    })

    console.log("\x1b[92mSharing file\x1b[39m \x1b[96m" + filename + "\x1b[39m")
}


if (foundSSL) {
    const httpsServer = https.createServer(sslcredentials, app)
    httpsServer.listen(8443)
} else {
    const httpServer = http.createServer(app)
    httpServer.listen(8080)
}

console.log("\x1b[92mYour application is available at\x1b[39m \x1b[1;4;96m" + require('ip').address('public', 'ipv4') + ':' + port.toString(10) + "\x1b[22;24;39m")
