import pytest
import shutil
from pathlib import Path

from src.agent.file_system import (
    write_file,
    read_file,
    list_files,
    get_file_tree,
    clear_workspace,
    WORKSPACE_ROOT,
)


@pytest.fixture(autouse=True)
def clean_workspace():
    clear_workspace()
    yield
    clear_workspace()


def test_write_and_read_file():
    write_file("test.txt", "hello world")
    content = read_file("test.txt")
    assert content == "hello world"


def test_write_nested_file():
    write_file("src/components/App.tsx", "export default function App() {}")
    content = read_file("src/components/App.tsx")
    assert "App" in content


def test_read_nonexistent_file():
    with pytest.raises(FileNotFoundError):
        read_file("does_not_exist.txt")


def test_overwrite_file():
    write_file("test.txt", "first")
    write_file("test.txt", "second")
    content = read_file("test.txt")
    assert content == "second"


def test_list_files():
    write_file("a.txt", "a")
    write_file("b.txt", "b")
    files = list_files()
    names = [f["name"] for f in files]
    assert "a.txt" in names
    assert "b.txt" in names


def test_get_file_tree():
    write_file("src/index.ts", "console.log('hi')")
    write_file("README.md", "# Hello")
    tree = get_file_tree()
    names = [f["name"] for f in tree]
    assert "src" in names
    assert "README.md" in names


def test_clear_workspace():
    write_file("test.txt", "data")
    clear_workspace()
    tree = get_file_tree()
    assert len(tree) == 0