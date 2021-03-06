const fs = require('fs');
const chalk = require('chalk');

const db = require('../../db');
const config = require('../../config');
const confirm = require('../../util/confirm-prompt');
const readMigrations = require('../../util/read-migrations');
const plmFactory = require('../../util/print-latest-migration');

exports.command = 'force-up';
exports.desc = 're-writes the knex migrations table entirely based on your migration directory';

exports.builder = {};

exports.handler = async (yargs) => {
  const printLatest = plmFactory(yargs); // TODO: use middleware

  const schema = config.migrations.schema || 'public';
  const table = config.migrations.table || 'knex_migrations';

  const migrationsPath = db.getMigrationsPath();
  if (!fs.existsSync(migrationsPath)) {
    console.error(`The migrations folder ${migrationsPath} does not exist!`);
    return process.exit(1);
  }

  const migrations = readMigrations(migrationsPath);
  const highestNumber = migrations
    .map(migration => migration.id)
    .reduce((a, b) => Math.max(a, b), 0);

  console.log(`This will re-write the knex_migrations table based on ${migrationsPath}`);
  console.log(
    chalk.redBright('Use of this tool implies that the database has been migrated fully!\n'),
  );

  try {
    await confirm('Type the number of the highest migration to continue: ', `${highestNumber}`);
  } catch (err) {
    console.log('Not re-writing the migrations table.');
    return process.exit(2);
  }

  const knex = db.connectAsSuper();

  migrations.sort((a, b) => a.id - b.id);

  await knex(`${schema}.${table}`).del();
  await knex(`${schema}.${table}`)
    .insert(migrations.map(migration => ({
      name: migration.name,
      batch: 1,
      migration_time: knex.fn.now(),
    })));

  console.log('Migrations table re-written!\n');
  await printLatest(knex);

  return process.exit(0);
};
