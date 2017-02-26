var
  webpage = require('webpage'),
  fs      = require('fs'),
  system  = require('system'),
  margin             = system.args[5] || '0cm',
  orientation        = system.args[6] || 'portrait',
  cookie_file        = system.args[7],
  resources_time_out = system.args[8] || 5000,
  render_time        = system.args[9] || 10000 ,
  time_out           = system.args[10] || 90000 ,
  viewport_width     = system.args[11] || 600,
  viewport_height    = system.args[12] || 600,
  redirects_num      = system.args[13] || 0,
  cookies = {},
  address, output, size;

function error(msg) {
  msg = msg || 'Unknown error';
  console.log(msg);
  phantom.exit(1);
  throw msg;
}

function print_usage() {
  console.log('Usage: rasterize.js URL filename [paperwidth*paperheight|paperformat] [zoom] [margin] [orientation] [cookie_file] [resources_time_out] [render_time] [time_out] [viewport_width] [viewport_height] [max_redirects_count]');
  console.log('  paper (pdf output) examples: "5in*7.5in", "10cm*20cm", "A4", "Letter"');
}

window.setTimeout(function () {
  error("Shit's being weird no result within: " + time_out + "ms");
}, time_out);

function renderUrl(url, output, options) {
  options = options || {};

  var statusCode,
      page = webpage.create();

  for (var k in options) {
    if (options.hasOwnProperty(k)) {
      page[k] = options[k];
    }
  }

  page.settings.resourceTimeout = resources_time_out;
  page.onResourceTimeout = function(request) {
     console.log('Resource timeout (#' + request.id + '): ' + request.url + ' ' + request.time);
  };

  page.onConsoleMessage = function(msg) {
    console.log(msg);
  }

  // determine the statusCode
  page.onResourceReceived = function (resource) {
    if (resource.url == url) {
      statusCode = resource.status;
    }
  };

  page.onResourceError = function (resourceError) {
    console.log(resourceError.errorString + ' (URL: ' + resourceError.url + ')');
  };

  page.onNavigationRequested = function (redirect_url, type, willNavigate, main) {
    if (main) {
      if (redirect_url !== url) {
        page.close();

        if (redirects_num-- >= 0) {
          renderUrl(redirect_url, output, options);
        } else {
          error(url + ' redirects to ' + redirect_url + ' after maximum number of redirects reached');
        }
      }
    }
  };

  console.log('Opening ' + url);
  page.open(url, function (status) {
    if (status !== 'success' || (statusCode != 200 && statusCode != null)) {
      if (fs.exists(output)) {
        fs.remove(output);
      }
      try {
        fs.touch(output);
      } catch (e) {
        console.log(e);
      }

      error('Unable to load the URL: ' + url + ' (HTTP ' + statusCode + ')');
    } else {
      console.log('Waiting render timeout....');
      window.setTimeout(function () {
        if (!renderPage(page)) {
          var renderInterval = setInterval(function() {
            if (renderPage(page)) {
              clearInterval(renderInterval);
            }
          }, render_time / 5);
        }
      }, render_time);
    }
  });
}

function renderPage(page) {
  var rendering = false;
  if (page.evaluate(function(){ return typeof PhantomJSPrinting == "object" && typeof PhantomJSPrinting.isRendering == "function"})) {
    rendering = page.evaluate(function() {
      return PhantomJSPrinting.isRendering();
    });
  }
  if (rendering) {
    console.log('Page is being rendering yet....')
    return false;
  }

  console.log('Rendering ' + output);
  if (page.evaluate(function(){ return typeof PhantomJSPrinting == "object";})) {
    paperSize = page.paperSize;
    paperSize.header = {};
    paperSize.header.height = page.evaluate(function() {
      return PhantomJSPrinting.header.height;
    });
    paperSize.header.contents = phantom.callback(function(pageNum, numPages) {
      return page.evaluate(function(pageNum, numPages){return PhantomJSPrinting.header.contents(pageNum, numPages);}, pageNum, numPages);
    });
    paperSize.footer = {};
    paperSize.footer.height = page.evaluate(function() {
      return PhantomJSPrinting.footer.height;
    });
    paperSize.footer.contents = phantom.callback(function(pageNum, numPages) {
      return page.evaluate(function(pageNum, numPages){return PhantomJSPrinting.footer.contents(pageNum, numPages);}, pageNum, numPages);
    });
    page.paperSize = paperSize;
  }
  page.render(output + '_tmp.pdf');

  if (fs.exists(output)) {
    fs.remove(output);
  }

  try {
    fs.move(output + '_tmp.pdf', output);
  } catch (e) {
    error(e);
  }
  console.log('Rendered to: ' + output, new Date().getTime());
  phantom.exit(0);
  return true;
}

if (cookie_file) {
  try {
    f = fs.open(cookie_file, "r");
    cookies = JSON.parse(f.read());
    fs.remove(cookie_file);
  } catch (e) {
    console.log(e);
  }
  phantom.cookiesEnabled = true;
  phantom.cookies = cookies;
}

if (system.args.length < 3 || system.args.length > 14) {
  print_usage() && phantom.exit(2);
} else {
  address = system.args[1];
  output  = system.args[2];

  page_options = {
    viewportSize: {
      width:  viewport_width,
      height: viewport_height
    }
  };

  if (system.args.length > 3 && system.args[2].substr(-4) === ".pdf") {
    size = system.args[3].split('*');
    page_options.paperSize = size.length === 2 ? { width:size[0], height:size[1], margin:'0px' }
      : { format:system.args[3], orientation:orientation, margin:margin };
  }
  if (system.args.length > 4) {
    page_options.zoomFactor = system.args[4];
  }

  renderUrl(address, output, page_options);
}
