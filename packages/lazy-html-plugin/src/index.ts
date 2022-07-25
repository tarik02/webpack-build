import * as Express from 'express';
import * as globPromise from 'glob-promise';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import * as Path from 'path';
import * as Webpack from 'webpack';
import { DefaultPathMapper } from './path/DefaultPathMapper';
import { EntryMiddleware } from './middleware/EntryMiddleware';
import { EventsMiddleware } from './middleware/EventsMiddleware';
import { isPathMapper, PathMapper } from './path/PathMapper';
import { injectDevServerMiddlewareSetup } from './quirks/injectDevServerMiddlewareSetup';
import { ConstantTemplatesManager } from './templates/ConstantTemplatesManager';
import { TemplatesManager } from './templates/TemplatesManager';
import { WatchingTemplatesManager } from './templates/WatchingTemplatesManager';

const PLUGIN_NAME = 'LazyHtmlPlugin';

type Options = {
  prefix: string;
  directory: string;
  inputGlob?: string | undefined;
  pathMapper?: (
    | undefined
    | {
      inputLoader: string;
      inputSuffix: string;
      outputSuffix: string;
    }
    | PathMapper
  );
};

type OptionsNormalized = {
  prefix: string;
  directory: string;
  inputGlob: string;
};

class LazyHtmlPlugin {
  protected options: Options;

  constructor(options: Options) {
    this.options = options;
  }

  apply(compiler: Webpack.Compiler): void {
    const options: OptionsNormalized = {
      prefix: this.options.prefix.replace(/(^[\\\/]*|[\\\/]*$)/g, ''),
      directory: Path.resolve(compiler.context, this.options.directory),
      inputGlob: this.options.inputGlob ?? '**/*',
    };

    const pathMapper = isPathMapper(this.options.pathMapper) ?
      this.options.pathMapper :
      new DefaultPathMapper(
        this.options.pathMapper?.inputLoader,
        this.options.pathMapper?.inputSuffix ?? '.html',
        this.options.pathMapper?.outputSuffix ?? '.html',
      );

    let templates: TemplatesManager | undefined;

    injectDevServerMiddlewareSetup(compiler.options, {
      before: (middlewares, devServer) => {
        templates = new WatchingTemplatesManager(compiler.watching);

        middlewares.unshift(
          {
            path: `/${options.prefix}/lazy-html-plugin/client.js`,
            middleware: Express.static(require.resolve('@tarik02/lazy-html-plugin/client')),
          },
          {
            path: `/${options.prefix}/lazy-html-plugin/events`,
            middleware: (new EventsMiddleware(templates)).handler,
          },
          {
            path: `/${options.prefix}`,
            middleware: (new EntryMiddleware(options.prefix, templates, pathMapper)).handler,
          },
        );
        return middlewares;
      }
    });

    compiler.hooks.watchRun.tapPromise(PLUGIN_NAME, async () => {
      if (templates === undefined || templates instanceof ConstantTemplatesManager) {
        templates = new ConstantTemplatesManager(
          (await globPromise(options.inputGlob, {
            cwd: options.directory,
            fs: compiler.inputFileSystem as any,
          }))
            .map(file => pathMapper.inputToName(file))
            .filter((file): file is string => file !== undefined)
        );
      }
    });

    compiler.hooks.run.tapPromise(PLUGIN_NAME, async () => {
      templates = new ConstantTemplatesManager(
        (await globPromise(options.inputGlob, {
          cwd: options.directory,
          fs: compiler.inputFileSystem as any,
        }))
          .map(file => pathMapper.inputToName(file))
          .filter((file): file is string => file !== undefined)
      );
    });

    compiler.hooks.assetEmitted.tapPromise(PLUGIN_NAME, async (file, { content }) => {
      if (file.startsWith(options.prefix + '/')) {
        const templateName = pathMapper.outputToName(
          Path.relative(options.prefix, file)
        );

        if (templateName !== undefined) {
          templates!.emit(templateName, content.toString('utf-8'));
        }
      }
    });

    compiler.hooks.make.tapPromise(PLUGIN_NAME, async compilation => {
      const childCompiler = compilation.createChildCompiler(
        PLUGIN_NAME,
        compilation.options.output,
      );
      childCompiler.context = compiler.context;
      childCompiler.inputFileSystem = compiler.inputFileSystem;
      childCompiler.outputFileSystem = compiler.outputFileSystem;

      for (const name of templates!.used()) {
        (new HtmlWebpackPlugin({
          template: `${ Path.resolve(options.directory, pathMapper.nameToInput(name)) }`,
          filename: `${ options.prefix }/${ pathMapper.nameToOutput(name) }`,
          chunks: [
            'app'
          ],
        })).apply(childCompiler);
      }

      childCompiler.hooks.initialize.call();

      const [entries, childCompilation] = await new Promise<[Webpack.Chunk[], Webpack.Compilation]>(
        (resolve, reject) => childCompiler.runAsChild((err, entries, childCompilation) => {
          if (err) {
            reject(err);
          } else {
            resolve([entries!, childCompilation!]);
          }
        })
      );

      compilation.errors.push(
        ...childCompilation.errors
      );
      childCompilation.errors.length = 0;
    });

    compiler.hooks.afterCompile.tapPromise(PLUGIN_NAME, async compilation => {
      compilation.contextDependencies.add(options.directory);
    })
  }
}

export = LazyHtmlPlugin;
