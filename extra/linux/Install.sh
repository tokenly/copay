#!/bin/bash
thisdir=`cd "$(dirname "$0")" && pwd`
sudo ln -s -f "$thisdir"/Pockets /usr/bin/Pockets
sudo ln -s -f "$thisdir"/.desktop ~/.local/share/applications/pockets.desktop
xdg-mime default pockets.desktop x-scheme-handler/pockets
xdg-mime default pockets.desktop x-scheme-handler/copay
xdg-mime default pockets.desktop x-scheme-handler/bitcoin
xdg-mime default pockets.desktop x-scheme-handler/counterparty
echo "Pockets wallet installed!"
