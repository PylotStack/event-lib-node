## Example: Movie Rental Store 


All files for this example can be found in the `./sample/movieRental/` folder

### Creating an event stack


The first step to creating an event sourced application is to create an event stack. This is a data structure which will allow you to save actions to the event stream.

For this example, let's create an event stack for keeping track of peoples video rentals. To start, we will create an event stack and give it a name.


```typescript
import { defineEventStack } from "@sctrl/event-stack";

const personMovieRentals = defineEventStack("personMovieRentals");
```

### Creating Actions


The first thing to do now will be to add the ability for a user to checkout and return a movie. We do that by creating two actions, `RENT_MOVIE` and `RETURN_MOVIE`. 


```typescript

const personMovieRentals = defineEventStack("personMovieRentals")
    .action("RENT_MOVIE", (ctx, { movieName }) => {
        return ctx.commit();
    })
    .action("RETURN_MOVIE", (ctx, { movieName }) => {
        return ctx.commit();
    });

```

So what we have done is give the ability for two actions to be made for `personMovieRentals` event stacks. Currently we don't have any rules implementing preventing people from renting more than one movie, returning movies they didn't rent, etc. but we will add that later on.

### Creating a view


Let's implement the ability to see what movies this user has rented. We can do this by creating a view from the event stack and defining what data should be returned from each events.


```typescript
const currentlyRentedMoviesView = personMovieRentals
    .createView("currentlyRentedMovies", { movies: [] })
    .event("RENT_MOVIE", (state, ev) => {
        return {
            ...state,
            movies: [...state.movies, ev.payload.movieName],
        };
    })
    .event("RETURN_MOVIE", (state, ev) => {
        return {
            ...state,
            movies: state.movies.filter(movieName => movieName !== ev.payload.movieName),
        };
    });
```

So with the above view, when we recieve a `RENT_MOVIE` event we will store the movie into the movies array. When we receive a `RETURN_MOVIE` event we will remove the movie from the array.

### Testing our event stack and view


Now that we've added a bit of code, we will test out the code to see if it is working as expected. For this script, we will be using some of the underlying primitives of the library to test our code. Later on in this example we will dive into some of the abstractions of the library which make interacting with event stacks more intuitive and user friendly

`./sample/movieRental/1_movieRentalScript.ts`

```typescript
import { personMovieRentals, currentlyRentedMoviesView } from "./1_movieRental";
import { compileView, executeAction } from "@sctrl/event-stack";
import { local } from "@sctrl/event-stack";

async function main() {
    // Create a locally stored (RAM) event stack
    const movie_rental_account_stack = local.localStack("teststack");

    // Generate the view state from the event stack we recently created which is empty. Notice how the view returns no items
    const result = await compileView(movie_rental_account_stack, currentlyRentedMoviesView.definition);

    console.log(result);
    /**
     * {
     *   movies: []
     * }
     */

    // Execute and store the rent movie action on the event stack
    await executeAction(movie_rental_account_stack, personMovieRentals.definition.actions.RENT_MOVIE, { movieName: "The Matrix" });

    // Generate the view again now that we have a new event on the event stack
    const result2 = await compileView(movie_rental_account_stack, currentlyRentedMoviesView.definition);

    // The rented movie now appears in the view
    console.log(result2);
    /**
     * {
     *   movies: [
     *     "The Matrix",
     *   ] 
     * }
     */
}

main();
```

You can run the script using ts-node or your favorite typescript runtime.

TS-Node:

```sh
    node -r ts-node/register sample/movieRental/1_movieRentalScript.ts
```

### Creating a model


In the above example, we used the `executeAction` internal function of the library to execute the action for our event stack along with the `compileView` function to view the state of our application. While these functions will get the job done, a model makes it much easier and more intuitive to interact with our event stack.

First, we will create a new model and map the two actions we created earlier

```typescript
export const personMovieRentalsModel = personMovieRentals
    .mapModel((ctx) => {
        return {
            rentMovie: ctx.mapAction("RENT_MOVIE", (movieName) => ({ movieName })),
            returnMovie: ctx.mapAction("RETURN_MOVIE", (movieName) => ({ movieName })),

            currentlyRentedMovies: ctx.mapView(currentlyRentedMoviesView.definition, "movies"),
        };
    });
```

In the above code, we are creating a model with two methods, `rentMovie` and `returnMovie`. When invoked, these methods will trigger the `executeAction` function earlier, storing the results on the event stack.

Next we map the `currentlyRentedMovies` view we created earlier onto the model so we can more easily access this data in our script.

### Using our model in a script


To use our model, let's modify our old script to use the new model. In the following script, we will replace the primites we were using before like `compileView` and `executeAction` and use the new model we just created.

`./sample/movieRental/2_movieRentalScript.ts`

```typescript
import { personMovieRentalsModel } from "./1_movieRental";
import { local } from "@sctrl/event-stack";

async function main() {
    // Create a locally stored (RAM) event stack
    const movie_rental_account_stack = local.localStack("teststack");

    // Create a model from our event stack which is empty. Notice how the view returns no items
    const personMovieRentals = await personMovieRentalsModel.fromStack(movie_rental_account_stack, undefined);

    // The view is generated automatically from the model, so we can print it out without having to compileView()
    console.log(personMovieRentals.currentlyRentedMovies);
    /**
     * []
     */

    // Let's rent a movie then take a look at our view again
    await personMovieRentals.rentMovie("The Matrix");

    // The rented movie now appears on the model
    console.log(personMovieRentals.currentlyRentedMovies);
    /**
     * [
     *   "The Matrix",
     * ]
     */
}

main();
```

### Adding business rules to your model


We currently have a working model, but aren't enforcing any business constraints against the actions. Let's go back and modify the `RENT_MOVIE` and `RETURN_MOVIE` action to be a bit smarter.

For `RENT_MOVIE` we will start off by adding the rule that you cannot rent a movie if you already have a movie of the same name rented. To implement this we will need to pull in information about the current state of the event stack to determine if a movie is already rented or not. To do this, we will use the context object to pull in the `currentlyRentedMoviesView`, allowing us to make decisions based on the state of our stack.

```typescript
    .action("RENT_MOVIE", async (ctx, { movieName }) => { // Switched to async
        // Use the context to pull the currentlyRentedMovies view 
        const currentlyRentedMovies = await ctx.view(currentlyRentedMoviesView.definition);
        
        // Check to see if the movie is already rented, if so reject with an error message
        if (currentlyRentedMovies.movies.includes(movieName)) return ctx.reject("MOVIE_ALREADY_RENTED");

        // Use the context to commit the RENT_MOVIE event
        return ctx.commit();
    })
```

Next we will do the same thing for the `RETURN_MOVIE` action, preventing a person from returning a movie which they have not rented. Implementing this will be similar to `RENT_MOVIE`, just inversing the condition for checking if it exists.

```typescript
    .action("RETURN_MOVIE", async (ctx, { movieName }) => { // Switched to async
        // Use the context to pull the currentlyRentedMovies view 
        const currentlyRentedMovies = await ctx.view(currentlyRentedMoviesView.definition);
        
        // Check to see if the movie is rented, if not reject with an error message
        if (!currentlyRentedMovies.movies.includes(movieName)) return ctx.reject("MOVIE_NOT_RENTED");

        // Use the context to commit the RETURN_MOVIE event
        return ctx.commit();
    })
```

### Validating our business rules and testing our code


To validate our code we could create a script as we have done before, but it would be best to test this logic with a unit test. We can do that manually or by using the `testUtils` functions located in this library. For this example, we will investigate the latter.

To test our code, we will simply define actions + expected results and the test runner will validate that our code works as expected.

```typescript
import "jest";
import { testUtils } from "@sctrl/event-stack";
import { personMovieRentals, currentlyRentedMoviesView } from "./3_movieRental";

describe("Movie Rental Store Tests", () => {
    it("movie rental and return tests",
        testUtils.stack(personMovieRentals.definition)
            // Rent a movie and ensure the event is stored
            .onAction("RENT_MOVIE", { movieName: "Forest Gump" }).commit()

            // Try renting the same movie again and ensure the event is not stored because it is already rented
            .onAction("RENT_MOVIE", { movieName: "Forest Gump" }).reject("MOVIE_ALREADY_RENTED")

            // Check our view state to ensure the movie shows up as expected
            .assertView(currentlyRentedMoviesView.definition, { movies: ["Forest Gump"] })

            // Return the movie and ensure the event is stored
            .onAction("RETURN_MOVIE", { movieName: "Forest Gump" }).commit()

            // Try returning the same movie again and ensure the event is not stored because it is not rented
            .onAction("RETURN_MOVIE", { movieName: "Forest Gump" }).reject("MOVIE_NOT_RENTED")

            // Check our view state to ensure the movie is no longer visible
            .assertView(currentlyRentedMoviesView.definition, { movies: [] })
    );
});
```

We can run the test by invoking `npm run test` in the terminal:

```sh
    npm run test ./sample/movieRental/3_movieRental.test.ts
```

### Conclusion


Throughout this tutorial you have:

* Created an event stack definition
* Defined actions and business logic rules
* Created a view as a state representation of the event stack
* Created a easy to use model for interacting with your event stack
* Tested your code

Hopefully this tutorial can help you get up and running with using event sourcing in your applications. Check out the other tutorials in this repo to learn more about how you can use this library to build event sourcing applications.
