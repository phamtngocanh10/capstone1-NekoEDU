"""Offline connection-string tests: run directly, without pytest DB fixtures."""
from pathlib import Path
import sys
import unittest

from sqlalchemy.engine import URL, make_url

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.prepare_database import PreparationError, clone_database_url


class DatabaseUrlTests(unittest.TestCase):
    def odbc_url(self, connection):
        return URL.create("mssql+pyodbc", query={"odbc_connect": connection})

    def test_explicit_url_changes_only_database(self):
        source = make_url("mssql+pyodbc://name:synthetic@localhost/NEKO_EDU?driver=Example&Encrypt=yes")
        result = clone_database_url(source, "isolated_test")
        self.assertEqual(result.database, "isolated_test")
        self.assertEqual(result.password, source.password)
        self.assertEqual(result.query, source.query)

    def test_braced_semicolon_and_escaped_brace_are_preserved(self):
        connection = "DRIVER={Example Driver};PWD={fake;key}}value};DATABASE={NEKO_EDU};SERVER=.\\SQLEXPRESS;"
        result = clone_database_url(self.odbc_url(connection), "isolated_test")
        self.assertEqual(result.query["odbc_connect"], connection.replace("DATABASE={NEKO_EDU}", "DATABASE={isolated_test}"))
        self.assertEqual(result.database, "isolated_test")

    def test_initial_catalog_alias_with_spaces(self):
        source = "Driver={Example}; Initial Catalog = NEKO_EDU ; Trusted_Connection=yes"
        result = clone_database_url(self.odbc_url(source), "master")
        self.assertIn("Initial Catalog={master};", result.query["odbc_connect"])
        self.assertIn("Trusted_Connection=yes", result.query["odbc_connect"])

    def test_database_without_terminating_semicolon(self):
        result = clone_database_url(self.odbc_url("SERVER=localhost;database=NEKO_EDU"), "new_test")
        self.assertEqual(result.query["odbc_connect"], "SERVER=localhost;database={new_test};")

    def test_no_database_attribute_gets_one_explicit_target(self):
        result = clone_database_url(self.odbc_url("SERVER=localhost;UID=test"), "new_test")
        self.assertEqual(result.query["odbc_connect"], "SERVER=localhost;UID=test;DATABASE={new_test};")

    def test_database_text_inside_password_is_not_an_attribute(self):
        source = "PWD={fake;Database=other};SERVER=localhost;DATABASE=NEKO_EDU;"
        result = clone_database_url(self.odbc_url(source), "new_test")
        self.assertIn("PWD={fake;Database=other};", result.query["odbc_connect"])

    def test_duplicate_database_aliases_are_rejected(self):
        for source in ("DATABASE=one;Database=two", "DATABASE=one;Initial Catalog=two"):
            with self.subTest(source=source), self.assertRaises(PreparationError):
                clone_database_url(self.odbc_url(source), "new_test")

    def test_malformed_odbc_values_are_rejected(self):
        for source in ("Driver={unclosed", "PWD={closed}trailing;DATABASE=one", "no_equals;SERVER=local"):
            with self.subTest(source=source), self.assertRaises(PreparationError):
                clone_database_url(self.odbc_url(source), "new_test")

    def test_unsafe_identifiers_are_rejected(self):
        for name in ("other];DROP DATABASE", "with space", "", "x" * 129):
            with self.subTest(name=name), self.assertRaises(PreparationError):
                clone_database_url(self.odbc_url("DATABASE=NEKO_EDU"), name)

    def test_cloned_odbc_url_round_trips_for_test_fixture(self):
        result = clone_database_url(self.odbc_url("Driver={Example};Database=NEKO_EDU;Trusted_Connection=yes"), "new_test")
        reparsed = make_url(result.render_as_string(hide_password=False))
        self.assertEqual(reparsed.database, "new_test")
        self.assertEqual(reparsed.query["odbc_connect"], result.query["odbc_connect"])


if __name__ == "__main__":
    unittest.main()
