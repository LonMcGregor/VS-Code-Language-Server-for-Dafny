#!/bin/bash
echo Updating Dafny build from VS Code Binaries Directory
rm -r ./dafny/dafny
mkdir ./dafny/dafny
cp -r ../../dafny/Binaries/* ./dafny/dafny/
