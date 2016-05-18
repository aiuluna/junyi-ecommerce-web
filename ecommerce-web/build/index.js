var fs = require('fs'),
    fse = require('fs-extra'),
    path = require('path'),
    crypto = require('crypto'),
    Q = require('q'),
    UglifyCSS = require('uglifycss'),
    UglifyJS = require('uglify-js'),
    qiniu = require('qiniu'),
    archiver = require('archiver'),
    env, config;  // config depends on env

var TEMP_DIR = path.join(__dirname, 'temp'),
    PROJECT_DIR = path.dirname(path.resolve(__dirname)),
    IGNORED_FOLDERS = ['.idea', 'build', 'node_modules'],
    FILE_HASH_SET = {},
    UPLOAD_TO_CDN = true,  // switch for test only
    UPLOAD_QUEUE = [];

(function main() {
  if (process.argv.length !== 3) {
    outputUsageAndExit();
    return;
  }
  env = process.argv[2].toLowerCase();
  if (env !== 'qa' && env !== 'prod') {
    outputUsageAndExit();
    return;
  }
  // 读取相应的配置文件
  console.log('Loading config.' + env + '.json');
  config = require('./config.' + env + '.json');
  // configure qiniu
  qiniu.conf.ACCESS_KEY = config.qiniu.access_key;
  qiniu.conf.SECRET_KEY = config.qiniu.secret_key;

  console.log('\nPreparing build dir...');
  // 注意：fse.emptyDirSync只会清理指定目录下的文件，如果有子目录它是不会清理的
  //fse.emptyDirSync(TEMP_DIR);
  if (fs.existsSync(TEMP_DIR)) {
    deleteFolderRecursive(TEMP_DIR);
  }
  fs.mkdirSync(TEMP_DIR);
  walk(PROJECT_DIR);
  prune();

  console.log('\nProcessing view html...');
  processViews(path.join(TEMP_DIR, 'views'));
  if (UPLOAD_TO_CDN) {
    UPLOAD_QUEUE.reduce(Q.when, Q())
      .done(
        function() {
          doPackage();
        },
        function(err) {
          console.error(err);
          process.exit(1);
        }
      );
    return;
  }

  doPackage();
})();

function outputUsageAndExit() {
  console.log('usage: node ' + process.argv[1] + ' <qa|prod>');
  process.exit(0);
}

function deleteFolderRecursive(path) {
  var files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach(function(file, index) {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

function walk(dir) {
  var files = fs.readdirSync(dir);
  files.forEach(function(file) {
    var curPath = path.join(dir, file),
        relPath = _relPathToProjectDir(curPath);
    if (fs.lstatSync(curPath).isDirectory()) {
      if (IGNORED_FOLDERS.indexOf(relPath) === -1) {
        // create the folder and recursively walk
        fs.mkdirSync(path.join(TEMP_DIR, relPath));
        walk(curPath);
      } else {
        console.log('Ignore folder:', curPath);
      }
    } else {
      console.log('Copying file:', curPath);
      fse.copySync(curPath, path.join(TEMP_DIR, relPath));
    }
  });
}

function _relPathToProjectDir(projectPath) {
  return projectPath.substr(PROJECT_DIR.length + 1);
}

function prune() {
  _removeFilesInFolder(path.join(TEMP_DIR, 'public', 'css'), false);
  _removeFilesInFolder(path.join(TEMP_DIR, 'public', 'js'), false);
  _removeFilesInFolder(path.join(TEMP_DIR, 'public', 'wap', 'css'), false);
  _removeFilesInFolder(path.join(TEMP_DIR, 'public', 'wap', 'js', 'weixin'), true);
  _removeFilesInFolder(path.join(TEMP_DIR, 'public', 'wap', 'js'), false);
}

function _removeFilesInFolder(dir, rmdirIfEmpty, ext) {
  var files = fs.readdirSync(dir),
      rmdir = !!rmdirIfEmpty;  // 如果目录为空，删除目录
  files.forEach(function(file) {
    var curPath = path.join(dir, file);
    if (!fs.lstatSync(curPath).isDirectory()) {
      if (!ext || path.extname(file) === ext) {
        fs.unlinkSync(curPath);
      } else {
        rmdir = false;
      }
    } else {
      rmdir = false;
    }
  });
  if (rmdir) {
    fs.rmdirSync(dir);
  }
}

function processViews(dir) {
  var files = fs.readdirSync(dir);
  files.forEach(function(file) {
    var curPath = path.join(dir, file);
    if (fs.lstatSync(curPath).isDirectory()) {
      processViews(curPath);
    } else if (path.extname(file) === '.html') {
      console.log('Processing view:', curPath);
      var content = fs.readFileSync(curPath, 'utf8'),
          isWap = curPath.indexOf(path.join('views', 'wap')) !== -1,
          htmlProcessed = processViewHtml(content, isWap);
      fs.writeFileSync(curPath, htmlProcessed, 'utf8');
    }
  });
}

function processViewHtml(content, isWap) {
  var lines = content.split('\n'),
      prevIsCss = false,
      prevIsJs = false,
      linesProcessed = [],
      cssFiles, jsFiles;
  lines.push('');  // for EOF
  lines.map(function(line) {
    if (_contains(line, '<link') && _contains(line, 'rel="stylesheet"') && _contains(line, 'href=')) {
      var cssFile = _param(line, 'href'),
          isExternalCss = cssFile.indexOf('http://') === 0 || cssFile.indexOf('https://') === 0;
      if (cssFile && !isExternalCss) {
        if (!prevIsCss) {
          cssFiles = [];
          prevIsCss = true;
        }
        if (isWap) {
          cssFiles.push(path.join(PROJECT_DIR, 'public', 'wap', cssFile));
        } else {
          cssFiles.push(path.join(PROJECT_DIR, 'public', cssFile));
        }
        linesProcessed.push('<!--' + line.replace(/<!--[\w\W]*?-->/g, '').trim() + '-->');
        return;
      }
    } else if (_contains(line, '<script') && _contains(line, 'src=')) {
      var jsFile = _param(line, 'src'),
          isExternalJs = jsFile.indexOf('http://') === 0 || jsFile.indexOf('https://') === 0;
      if (jsFile && !isExternalJs) {
        if (!prevIsJs) {
          jsFiles = [];
          prevIsJs = true;
        }
        if (isWap) {
          jsFiles.push(path.join(PROJECT_DIR, 'public', 'wap', jsFile));
        } else {
          jsFiles.push(path.join(PROJECT_DIR, 'public', jsFile));
        }
        linesProcessed.push('<!--' + line.replace(/<!--[\w\W]*?-->/g, '').trim() + '-->');
        return;
      }
    }
    if (prevIsCss) {
      var uglifiedCss = UglifyCSS.processFiles(cssFiles);
      //console.log(uglifiedCss);
      var hashCss = _hash(uglifiedCss),
          fileCss = 'css/' + hashCss + '.css',
          pathCss = (isWap ? 'wap/' : '') + fileCss;
      if (!FILE_HASH_SET[pathCss]) {
        FILE_HASH_SET[pathCss] = true;
        fs.writeFileSync(path.join(TEMP_DIR, 'public', pathCss), uglifiedCss, 'utf8');
        // 因为CSS用到了background-image，暂时还不支持上传到CDN
        //UPLOAD_QUEUE.push(uploadToQiniu.bind(null, fileCss, path.join(TEMP_DIR, 'public', pathCss)));
      }
      //linesProcessed.push('<link rel="stylesheet" href="<%=#resCdnUrl(\'' + fileCss + '\')%>" type="text/css"/>');
      linesProcessed.push('<link rel="stylesheet" href="' + fileCss + '" type="text/css"/>');
      prevIsCss = false;
    }
    if (prevIsJs) {
      var uglifiedJs = UglifyJS.minify(jsFiles);
      //console.log(uglifiedJs.code);
      var hashJs = _hash(uglifiedJs.code),
          fileJs = 'js/' + hashJs + '.js',
          pathJs = (isWap ? 'wap/' : '') + fileJs;
      if (!FILE_HASH_SET[pathJs]) {
        FILE_HASH_SET[pathJs] = true;
        fs.writeFileSync(path.join(TEMP_DIR, 'public', pathJs), uglifiedJs.code, 'utf8');
        UPLOAD_QUEUE.push(uploadToQiniu.bind(null, fileJs, path.join(TEMP_DIR, 'public', pathJs)));
      }
      linesProcessed.push('<script type="text/javascript" src="<%=#resCdnUrl(\'' + fileJs + '\')%>"></script>');
      prevIsJs = false;
    }
    linesProcessed.push(line);
  });
  return linesProcessed.join('\n');
}

function _contains(line, phrase) {
  return line.indexOf(phrase) !== -1;
}

// 简单版本，必须使用双引号
function _param(line, name) {
  var reg = new RegExp(name + '="([^"]*)"', 'i');
  var r = line.match(reg);
  if (r) return r[1];
  return null;
}

function _hash(s) {
  var shasum = crypto.createHash('md5');
  shasum.update(s);
  return shasum.digest('hex').substr(0, 8) + '_' + s.length.toString(16);
}

function uploadToQiniu(key, localFile) {
  var putPolicy = new qiniu.rs.PutPolicy(config.qiniu.bucket_name + ':' + key);
  var token = putPolicy.token();
  var extra = new qiniu.io.PutExtra();
  var deferred = Q.defer();
  qiniu.io.putFile(token, key, localFile, extra, function(err, ret) {
    if(!err) {
      // 上传成功， 处理返回值
      console.log('File uploaded to CDN:', key);
      deferred.resolve(true);
    } else {
      // 上传失败， 处理返回代码
      console.log('File upload error (' + key + '):', err);
      deferred.resolve(false);
    }
  });
  return deferred.promise;
}

function doPackage() {
  console.log('\nPackaging project to zip file...');

  fse.emptyDirSync(path.join(__dirname, 'out'));
  var output = fs.createWriteStream(path.join(__dirname, 'out', 'ecommerce-web-' + env + '.zip'));
  var archive = archiver('zip');

  output.on('close', function() {
    console.log(archive.pointer() + ' total bytes');

    // clean temp dir
    deleteFolderRecursive(TEMP_DIR);

    console.log('\n~~ DONE ~~');
    process.exit(0);
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);
  archive.bulk([
    { expand: true, cwd: TEMP_DIR, src: ['**'], dest: ''}
  ]);
  archive.finalize();
}