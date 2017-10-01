# Homematic-Virtual-Interface Sonos Plugin

This plugin creates a 19Key Remote for every Sonos ZonePlayer
Map the first 18 Keys in the device settings to sonos commands:

Play, Pause, Next, Prev, VolUp, VolDn, Spotify

To do that open the device settings in webgui there is a field called CMD_PRESS_SHORT. setup the commands there for the specified key.
The spotiy command is a little special. Setup the playlist you with to play in the CMD_PRESS_LONG field for that key.

Press the key and the plugin will execute the command.

There is a special Channel 19 and it will change in the future.
This channel contains currently 2 parameters 

TARGET_VOLUME, PLAYLIST

you may set the PLAYLIST Parameter with a playlist url (currently spotify only is supported -> eg : spotify:user:spotify_germany:playlist:1dPjXhd0s7DBTCuaolLVSm)
and the current queue will replaced by this playlist and the zoneplayer will play that list.



Sonos Coordinator:

There is a virtual device named SONOS_Coordinator.
You can group players and create meshes thru this coordinator. There is a channel with number 4 and a datapoint named COMMAND.
This is where the magic happens.


remove player from group: standalone|playername
groups players : createmesh|player1,player2...
toggle group : toggle|playername

there is also a command to select and play on of your Sonos favs: playFav|Playername|FavName 

you may also combine commands with a * as separator, so the coordinator will execute them in a row. 
