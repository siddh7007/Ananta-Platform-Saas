#!/bin/bash
TOKEN="2|1mxflVojTi1ILcjT3hZfvDCgVn9GpCkEz6yh5o1Y2484572a"
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8000/api/v1/$1"
