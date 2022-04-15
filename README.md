# @sctrl/event-stack

A Javascript library for managing and maintaining event sourced systems. Focused on usability and ease of use, this library simplifies interactions with the underlying eventing architecture to enable developers to create complex event based models with little worry for how things work under the hood.

Examples can be found in the `/sample` demonstrating how to create an event stack, view, model definition, etc.

This library contains the foundations for working with event stacks. Future libraries will be created for storing this data in a database, caching, and other features.

## Installation

Install library using npm

```bash
npm install @sctrl/event-stack
```

## Example

You can find a step by step tutorial for creating an event sourced application using this library by following the links below

[Movie Rental Store](sample/movieRental/movieRental.md)

You can also find many example models and scripts in the `./sample` directory.

## Terminology

Event Stack - A data structure for managing interactions with underlying event streams. Usually you create one event stack per model. Event stacks store actions in an ordered sequence, allowing the ability to build state from the underlying actions. Examples of event stack names are `bankAccount` or `userProfile`

Action - An action which takes place against the event stack, consisting of an action name and a payload. Actions are the fundamental building block of storing data in an event stack. Examples of action names would be `RETURN_BOOK` or `DEPOSIT_CASH`.

View - A state based representation of the actions in an event stack. By running through all the actions which have occured in an event stack, you can build up a "view" of the data, allowing you to more easily work with the data instead of a sequence of events.

Query - Similar to a view but allows the building of more targeted state. By allowing parameters to be passed to the view reducer, a more purpose driven view of the data can be gathered.

Model - A collection of helper tools to make working with an event stack easier. Models provide mappers for Actions, Views, and Queries to allow developers to create objects which look like normal Javascript objects but interact with the event stack instead. Models make it easier to write more readable and concise code and remove the need for tedious orchestration code.