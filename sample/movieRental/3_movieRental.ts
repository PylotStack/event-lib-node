import { defineEventStack } from "../../src";


export const personMovieRentals = defineEventStack("personMovieRentals")
    .action("RENT_MOVIE", async (ctx, { movieName }) => { // Switched to async
        // Use the context to pull the currentlyRentedMovies view 
        const currentlyRentedMovies = await ctx.view(currentlyRentedMoviesView.definition);
        
        // Check to see if the movie is already rented, if so reject with an error message
        if (currentlyRentedMovies.movies.includes(movieName)) return ctx.reject("MOVIE_ALREADY_RENTED");

        // Use the context to commit the RENT_MOVIE event
        return ctx.commit();
    })
    .action("RETURN_MOVIE", async (ctx, { movieName }) => { // Switched to async
        // Use the context to pull the currentlyRentedMovies view 
        const currentlyRentedMovies = await ctx.view(currentlyRentedMoviesView.definition);
        
        // Check to see if the movie is rented, if not reject with an error message
        if (!currentlyRentedMovies.movies.includes(movieName)) return ctx.reject("MOVIE_NOT_RENTED");

        // Use the context to commit the RETURN_MOVIE event
        return ctx.commit();
    });


export const currentlyRentedMoviesView = personMovieRentals
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

export const personMovieRentalsModel = personMovieRentals
    .mapModel((ctx) => {
        return {
            currentlyRentedMovies: ctx.mapView(currentlyRentedMoviesView.definition, "movies"),
            rentMovie: ctx.mapAction("RENT_MOVIE", (movieName) => ({ movieName })),
            returnMovie: ctx.mapAction("RETURN_MOVIE", (movieName) => ({ movieName })),
        };
    });
