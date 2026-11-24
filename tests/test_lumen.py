"""Lumen overlay checks that need only php, node and bash (no panel, no packages)."""

import json
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = ROOT / "overlay" / "files"
NODE = ["node", "--experimental-strip-types", "--no-warnings"]


def run(cmd):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, check=False)


@unittest.skipUnless(shutil.which("php") and shutil.which("node"), "needs php and node")
class Parity(unittest.TestCase):
    def test_php_and_typescript_compile_the_same_css(self):
        php = run(["php", "tests/parity/run.php"])
        node = run(NODE + ["tests/parity/run.mts"])
        self.assertEqual(php.returncode, 0, php.stderr)
        self.assertEqual(node.returncode, 0, node.stderr)
        a, b = json.loads(php.stdout), json.loads(node.stdout)
        self.assertEqual(sorted(a["presets"]), sorted(b["presets"]))
        for name in a["presets"]:
            self.assertEqual(a["presets"][name], b["presets"][name], name)
        for name in a["cases"]:
            self.assertEqual(a["cases"][name], b["cases"][name], name)

    def test_presets_are_valid_and_pass_contrast(self):
        result = run(NODE + ["tests/parity/contrast.mts"])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_markup_never_reaches_the_stylesheet(self):
        # The CSS goes into a <style> element, so no "<" may survive: that rules out </style,
        # <!-- and <script in every spelling without parsing HTML.
        for cmd in (["php", "tests/parity/run.php"], NODE + ["tests/parity/run.mts"]):
            data = json.loads(run(cmd).stdout)
            for name, case in data["cases"].items():
                self.assertNotIn("<", case["css"], f"{cmd[0]}: {name}")
            for name, preset in data["presets"].items():
                self.assertNotIn("<", preset["css"] + preset["scoped"], f"{cmd[0]}: {name}")

    def test_custom_css_is_escaped_not_stripped(self):
        data = json.loads(run(["php", "tests/parity/run.php"]).stdout)
        css = data["cases"]["css breakout: closing tag"]["css"]
        self.assertIn(".x{color:red}\\3c /style>\\3c script>alert(1)\\3c /script>", css)
        css = data["cases"]["css strings keep their meaning"]["css"]
        self.assertIn('content:"a \\3c  b"} .a > .b{color:red}', css)


class Files(unittest.TestCase):
    def test_php_files_parse(self):
        if not shutil.which("php"):
            self.skipTest("needs php")
        for path in FILES.rglob("*.php"):
            result = run(["php", "-l", str(path)])
            self.assertEqual(result.returncode, 0, result.stdout)

    def test_boot_script_parses(self):
        if not shutil.which("node"):
            self.skipTest("needs node")
        result = run(["node", "--check", str(FILES / "public/lumen/boot.js")])
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_shell_scripts_parse(self):
        for path in (ROOT / "scripts").glob("*.sh"):
            result = run(["bash", "-n", str(path)])
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_patches_only_touch_known_files(self):
        allowed = {
            "config/app.php",
            "resources/scripts/lib/appearance.ts",
            "resources/scripts/components/elements/HydroLogo.tsx",
            "resources/scripts/routers/AuthenticationRouter.tsx",
            "resources/scripts/components/admin/AdminApp.tsx",
        }
        touched = set()
        for patch in (ROOT / "overlay" / "patches").glob("*.patch"):
            for line in patch.read_text().splitlines():
                if line.startswith("+++ b/"):
                    touched.add(line[6:])
        self.assertEqual(touched, allowed)

    def test_every_preset_names_itself(self):
        for path in (FILES / "resources/lumen/presets").glob("*.json"):
            data = json.loads(path.read_text())
            self.assertEqual(data["version"], 1, path.name)
            self.assertTrue(data["meta"]["name"], path.name)


if __name__ == "__main__":
    unittest.main()
