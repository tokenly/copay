#!/bin/bash
thisdir=`cd "$(dirname "$0")" && pwd`
sudo ln -s -f "$thisdir"/Pockets /usr/bin/Pockets
sudo ln -s -f "$thisdir"/.desktop ~/.local/share/applications/pockets.desktop
sudo cp "$thisdir"/favicon-32x32.png /usr/share/icons/hicolor/32x32/apps/Tokenly-Pockets.png
xdg-mime default pockets.desktop x-scheme-handler/pockets
xdg-mime default pockets.desktop x-scheme-handler/copay
xdg-mime default pockets.desktop x-scheme-handler/bitcoin
xdg-mime default pockets.desktop x-scheme-handler/counterparty
echo "Pockets wallet installed!"
