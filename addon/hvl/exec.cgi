#!/bin/tclsh


puts "Content-Type: text/plain"
puts ""



if { [catch {
    set content [read stdin]  
    set fo [open "ip" "w"]    
    regexp {(\d+)(\D)(\d+)(\D)(\d+)(\D)(\d+)} $content match
    puts $fo $match:7000
    close $fo
 
 
 } errorMessage] } {
  puts $errorMessage
}
