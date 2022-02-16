package main

import (
	"flag"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gomodule/redigo/redis"
	"github.com/gorilla/websocket"
	"github.com/tidwall/gjson"
	server "github.com/tidwall/modern-server"
)

const dist = 500 * 2

var (
	pool *redis.Pool // tile38 connection pool
	mu   sync.Mutex  // guard the connections
	all  map[string]*websocket.Conn
)

func main() {
	var tile38Addr string

	all = make(map[string]*websocket.Conn)

	server.Main(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ws" {
			handleWS(w, r)
		} else {
			server.HandleFiles(w, r)
		}
	}, &server.Options{
		Version: "0.0.1",
		Name:    "proximity-chat",
		Flags: func() {
			flag.StringVar(&tile38Addr, "tile38", ":9851", "")
		},
		FlagsParsed: func() {
			// Tile38 connection pool
			pool = &redis.Pool{
				MaxIdle:     16,
				IdleTimeout: 240 * time.Second,
				Dial: func() (redis.Conn, error) {
					return redis.Dial("tcp", tile38Addr)
				},
			}
			go monitorAll()
		},
		Usage: func(usage string) string {
			usage = strings.Replace(usage, "{{USAGE}}",
				"  -tile38 addr : "+
					"use the specified Tile38 server (default: *:9851)\n", -1)
			return usage
		},
	})
}

func monitorAll() { //全局一个连接，发送一次命令之后就一直等待tile38服务器的返回数据，位置是全球的所有人进入围栏就会有通知，比较奇怪。
	for {
		func() {
			conn := pool.Get()
			defer func() {
				conn.Close()
				time.Sleep(time.Second)
			}()
			resp, err := redis.String(conn.Do(
				"INTERSECTS", "people", "FENCE", "BOUNDS", -90, -180, 90, 180))
			if err != nil || resp != "OK" {
				log.Printf("nearby: %v", err)
				return
			}
			log.Printf("monitor geofence connected")
			var printCount int64 = 0
			for { //一直等待tile38返回的数据，然后广播给所有的ws连接
				msg, err := redis.Bytes(conn.Receive())
				printCount++
				if err != nil {
					log.Printf("monitor: %v", err)
					return
				} else {
					if printCount >= 10 {
						log.Printf("monitor 一直从tile38收到消息: %v", string(msg))
						printCount = 0
					}
				}
				mu.Lock()
				for _, c := range all {
					c.WriteMessage(1, msg)
				}
				mu.Unlock()
			}
		}()
	}
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	var upgrader = websocket.Upgrader{}
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade: %v", err)
		return
	}

	var meID string
	defer func() {
		// unregister connection
		mu.Lock()
		delete(all, meID)
		mu.Unlock()
		c.Close()
		log.Printf("disconnected")
	}()

	log.Printf("客户端新连接 connected(%s)", r.RemoteAddr)
	for { //每来一个浏览器就会新启动一个从浏览器接收数据的goroutine
		_, bmsg, err := c.ReadMessage()
		if err != nil {
			log.Printf("read: %v", err)
			break
		}
		msg := string(bmsg)
		log.Printf("服务器接收到客户端(%s)消息:%#v", r.RemoteAddr, msg)
		switch {
		case gjson.Get(msg, "type").String() == "Message": //客户端发送了消息,则服务器需要获取周围500m以内的人的ID，对这些人进行广播
			geojson := gjson.Get(msg, "geojson").String()
			func() {
				c := pool.Get()
				defer c.Close()
				replys, err := redis.Values(c.Do("NEARBY", "people",
					"IDS", "POINT",
					gjson.Get(geojson, "geometry.coordinates.1").Float(),
					gjson.Get(geojson, "geometry.coordinates.0").Float(),
					dist,
				))
				if err != nil {
					log.Printf("%v", err)
					return
				}
				if len(replys) > 1 {
					ids, _ := redis.Strings(replys[1], nil)
					for _, id := range ids {
						mu.Lock()
						if c := all[id]; c != nil {
							c.WriteMessage(1, bmsg)
						}
						mu.Unlock()
					}
				}
			}()
		case gjson.Get(msg, "type").String() == "Position": //客户端会定时上报的自己的位置
			id := gjson.Get(msg, "geojson.properties.id").String()
			if id == "" {
				break
			}
			if meID == "" {
				meID = id
				// register connection
				mu.Lock()
				all[meID] = c
				mu.Unlock()
			}
			func() {
				c := pool.Get()
				defer c.Close()
				//msg本身是GeoJSON格式的，可以直接设置
				geojson := gjson.Get(msg, "geojson")
				c.Do("SET", "people", id, "EX", 30, "OBJECT", geojson)
			}()
		}
	}
}
