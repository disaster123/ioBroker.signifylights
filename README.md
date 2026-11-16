![Logo](admin/signifylights.png)
# ioBroker.signifylights

[![NPM version](https://img.shields.io/npm/v/iobroker.signifylights.svg)](https://www.npmjs.com/package/iobroker.signifylights)
[![Downloads](https://img.shields.io/npm/dm/iobroker.signifylights.svg)](https://www.npmjs.com/package/iobroker.signifylights)
![Number of Installations](https://iobroker.live/badges/signifylights-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/signifylights-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.signifylights.png?downloads=true)](https://nodei.co/npm/iobroker.signifylights/)

**Tests:** ![Test and Release](https://github.com/disaster123/ioBroker.signifylights/workflows/Test%20and%20Release/badge.svg)

## signifylights adapter for ioBroker

Signify Lights adapter for all Types of Signify WLAN lights like WIZ, Philips WLAN and many more...

Questions and discussion here: https://forum.iobroker.net/topic/69656/test-adapter-signifylights

### DISCLAIMER

This project is NOT affiliated with, funded, or in any way associated with WIZ, Signify
or Philips. All brand and product names are trademarks or registered trademarks of their respective holders. 
Reference to a company or a product name does not imply approval or recommendation of 
that company or product to the exclusion of others.

## UDP response diagnostics

Device rejections (including Invalid params `-32602`, Security error `-32605`, and
`success: false`) stop retries only for a matched request and do not mark the lamp
offline or acknowledge the requested write. Logs contain the source IP/port,
known method, error code and a standard error description. Arbitrary device error
messages and payloads are omitted because they may contain credentials. Security
errors currently require separate investigation; authentication/HMAC support is
not part of this change.

Replies without an ID normally require a unique pending request with the same
source IP, port and method. Ambiguous concurrent requests are retained, and (except
for getPilot snapshots) remain ineligible for id-less matching until they leave
the queue. Explicit IDs take priority; the legacy getPilot request ID `0` remains
a wildcard only when no exact ID matches. Other explicit ID mismatches never
complete a request.

A successful getPilot snapshot can satisfy all equivalent pending ID `0` polls
and updates the read states once. An id-less snapshot leaves any nonzero-ID polls
pending when wildcard polls are present. Rejections still require a unique match.
Sequential id-less requests and rapid polling have no cooldown, including after
rejections or retry exhaustion. Delayed or duplicated id-less UDP replies cannot
be distinguished from fresh replies to a later request with identical metadata;
this inherent limitation also applies after retries and adapter restarts.

Traffic from an expected source IP/port establishes endpoint reachability for
pending requests on that endpoint, separately from method-specific receipt
tracking. A reply for one method does not claim correlation with unrelated methods,
but their exhaustion will not mark a device offline after traffic was received.
Malformed traffic is also reachability evidence, not a successful response.
Unexpected source ports are ignored without refreshing reachability (known protocol
ports 38899/38900 and explicitly pending destinations are accepted). True silence
retains the existing retry and offline behavior.

## Changelog
### 1.0.2 (2026-09-13)
- (disaster123) Hue changes now preserve the current saturation and brightness.
- (disaster123) Corrected configuration defaults and improved handling of missing device states.
- (disaster123) Replaced the UUID dependency with Node.js built-in UUID generation.
- (disaster123) Updated development tools and made type checks and regression tests mandatory in CI.

### 1.0.1 (2026-09-12)
- (iobroker-bot) Adapter requires node.js >= 22 now.
- (iobroker-bot) Adapter requires js-controller >= 6.0.11 now.

### 1.0.0 (2025-04-27)
* signifylights is now stable
* replaced the old device specific code with generic code
  to automatically support new devices without the need to get added

### 0.4.5 (2025-04-21)
* fix minimum deps

### 0.4.4 (2025-04-21)
* fix minimum deps

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License
MIT License

Copyright (c) 2025-2026 disaster123 <stefan-iobroker@prie.be>

originally developed by Copyright (c) 2022 nxtstep <privat@konzeptplus.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
